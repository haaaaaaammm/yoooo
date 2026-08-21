import "server-only";

import webPush from "web-push";

import {
  dispatchDiferenciasActivityPush,
  type DiferenciasActivity,
  type DiferenciasPushPayload,
  type DiferenciasPushRecipient,
} from "@/lib/diferencias-push-core";
import { getPrisma } from "@/lib/prisma";

type VapidConfiguration = {
  privateKey: string;
  publicKey: string;
  subject: string;
};

export type DiferenciasPushSubscriptionInput = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

function isBase64Url(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function hasDecodedLength(value: string, expectedLength: number) {
  return (
    isBase64Url(value) && Buffer.from(value, "base64url").length === expectedLength
  );
}

function isValidVapidSubject(subject: string) {
  try {
    const url = new URL(subject);
    return (
      (url.protocol === "mailto:" && subject.length > "mailto:".length) ||
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function getVapidConfiguration(): VapidConfiguration | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";

  if (
    !hasDecodedLength(publicKey, 65) ||
    !hasDecodedLength(privateKey, 32) ||
    !isValidVapidSubject(subject)
  ) {
    return null;
  }

  return { privateKey, publicKey, subject };
}

export function getDiferenciasVapidPublicKey() {
  return getVapidConfiguration()?.publicKey ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEndpoint(endpoint: string) {
  if (!endpoint || endpoint.length > 4096) {
    return false;
  }

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function parseDiferenciasPushSubscription(
  value: unknown
): DiferenciasPushSubscriptionInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const { auth, endpoint, p256dh } = value;

  if (
    typeof auth !== "string" ||
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    !isValidEndpoint(endpoint) ||
    !hasDecodedLength(p256dh, 65) ||
    !hasDecodedLength(auth, 16)
  ) {
    return null;
  }

  return { auth, endpoint, p256dh };
}

export function parseDiferenciasPushEndpoint(value: unknown) {
  return typeof value === "string" && isValidEndpoint(value) ? value : null;
}

export async function getActiveDiferenciasPushSubscriptions(): Promise<
  DiferenciasPushRecipient[]
> {
  const subscriptions = await getPrisma().diferenciasPushSubscription.findMany({
    select: {
      auth: true,
      endpoint: true,
      id: true,
      p256dh: true,
      user: { select: { isActive: true } },
      userId: true,
    },
    where: { user: { isActive: true } },
  });

  return subscriptions.map(({ user, ...subscription }) => ({
    ...subscription,
    isActive: user.isActive,
  }));
}

export async function removeDeadPushSubscriptions(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await getPrisma().diferenciasPushSubscription.deleteMany({
    where: { id: { in: ids } },
  });
}

export async function sendPushToSubscription(
  subscription: DiferenciasPushRecipient,
  payload: DiferenciasPushPayload,
  vapid: VapidConfiguration
) {
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { auth: subscription.auth, p256dh: subscription.p256dh },
    },
    JSON.stringify(payload),
    {
      TTL: 60 * 60 * 24,
      urgency: "normal",
      vapidDetails: {
        privateKey: vapid.privateKey,
        publicKey: vapid.publicKey,
        subject: vapid.subject,
      },
    }
  );
}

export async function sendDiferenciasActivityPush(
  activity: DiferenciasActivity
) {
  const vapid = getVapidConfiguration();

  if (!vapid) {
    console.warn(
      `[diferencias-push] Skipped ${activity.type}: VAPID is not configured correctly.`
    );
    return;
  }

  try {
    const subscriptions = await getActiveDiferenciasPushSubscriptions();

    await dispatchDiferenciasActivityPush(activity, subscriptions, {
      concurrency: 8,
      onTemporaryFailure(error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : "unknown";

        console.error(
          `[diferencias-push] ${activity.type} delivery failed temporarily (status: ${statusCode}).`
        );
      },
      removeDead: removeDeadPushSubscriptions,
      send: (subscription, payload) =>
        sendPushToSubscription(subscription, payload, vapid),
    });
  } catch (error) {
    console.error(
      `[diferencias-push] ${activity.type} dispatch failed without affecting the saved activity.`,
      error
    );
  }
}
