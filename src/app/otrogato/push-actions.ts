"use server";

import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import {
  getDiferenciasVapidPublicKey,
  parseDiferenciasPushEndpoint,
  parseDiferenciasPushSubscription,
} from "@/lib/diferencias-push";
import { getPrisma } from "@/lib/prisma";

type PushMutationResult = { message: string; ok: boolean };

export async function savePushSubscriptionAction(
  input: unknown
): Promise<PushMutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Log in again to enable notifications.", ok: false };
  }

  if (!getDiferenciasVapidPublicKey()) {
    return { message: "Push notifications are not configured.", ok: false };
  }

  const subscription = parseDiferenciasPushSubscription(input);

  if (!subscription) {
    return { message: "The browser returned an invalid subscription.", ok: false };
  }

  try {
    await getPrisma().diferenciasPushSubscription.upsert({
      create: { ...subscription, userId: user.id },
      update: { ...subscription, userId: user.id },
      where: { endpoint: subscription.endpoint },
    });
  } catch {
    return { message: "Could not save this device subscription.", ok: false };
  }

  return { message: "Notifications enabled.", ok: true };
}

export async function deletePushSubscriptionAction(
  rawEndpoint: unknown
): Promise<PushMutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Log in again to change notifications.", ok: false };
  }

  const endpoint = parseDiferenciasPushEndpoint(rawEndpoint);

  if (!endpoint) {
    return { message: "The browser returned an invalid subscription.", ok: false };
  }

  try {
    await getPrisma().diferenciasPushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
  } catch {
    return { message: "Could not disable this device subscription.", ok: false };
  }

  return { message: "Notifications disabled on this device.", ok: true };
}
