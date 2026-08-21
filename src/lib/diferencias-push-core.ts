export type DiferenciasActivity =
  | {
      actorDisplayName: string;
      content: string;
      postId: string;
      type: "post";
    }
  | {
      actorDisplayName: string;
      commentId: string;
      content: string;
      postId: string;
      type: "comment" | "reply";
    };

export type DiferenciasPushPayload = {
  body: string;
  commentId?: string;
  postId: string;
  title: string;
  type: DiferenciasActivity["type"];
  url: string;
};

export type DiferenciasPushRecipient = {
  auth: string;
  endpoint: string;
  id: string;
  isActive: boolean;
  p256dh: string;
  userId: string;
};

export type DiferenciasPushDispatchResult = {
  dead: number;
  failed: number;
  sent: number;
  targeted: number;
};

type DispatchDependencies = {
  concurrency?: number;
  onTemporaryFailure?: (
    error: unknown,
    recipient: DiferenciasPushRecipient
  ) => void;
  removeDead: (ids: string[]) => Promise<void>;
  send: (
    recipient: DiferenciasPushRecipient,
    payload: DiferenciasPushPayload
  ) => Promise<void>;
};

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 20;
const PREVIEW_LENGTH = 120;

export function createDiferenciasActivityPreview(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (normalized.length <= PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, PREVIEW_LENGTH - 3).trimEnd()}...`;
}

export function createDiferenciasPushPayload(
  activity: DiferenciasActivity
): DiferenciasPushPayload {
  const commentId = activity.type === "post" ? undefined : activity.commentId;
  const action =
    activity.type === "post"
      ? "posted"
      : activity.type === "reply"
        ? "replied"
        : "commented";
  const postPath = `/otrogato/${encodeURIComponent(activity.postId)}`;

  return {
    body: createDiferenciasActivityPreview(activity.content),
    ...(commentId ? { commentId } : {}),
    postId: activity.postId,
    title: `${activity.actorDisplayName} ${action}`,
    type: activity.type,
    url: commentId
      ? `${postPath}#comment-${encodeURIComponent(commentId)}`
      : postPath,
  };
}

function getPushStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return null;
}

export async function dispatchDiferenciasActivityPush(
  activity: DiferenciasActivity,
  subscriptions: DiferenciasPushRecipient[],
  dependencies: DispatchDependencies
): Promise<DiferenciasPushDispatchResult> {
  // There is intentionally no actor exclusion: every active subscribed user,
  // including the actor, receives every community activity notification.
  const recipients = subscriptions.filter(({ isActive }) => isActive);
  const payload = createDiferenciasPushPayload(activity);
  const deadIds: string[] = [];
  let cursor = 0;
  let failed = 0;
  let sent = 0;
  const requestedConcurrency = dependencies.concurrency ?? DEFAULT_CONCURRENCY;
  const normalizedConcurrency =
    Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
      ? Math.floor(requestedConcurrency)
      : DEFAULT_CONCURRENCY;
  const concurrency = Math.min(
    normalizedConcurrency,
    MAX_CONCURRENCY,
    Math.max(recipients.length, 1)
  );

  async function worker() {
    while (cursor < recipients.length) {
      const recipient = recipients[cursor];
      cursor += 1;

      try {
        await dependencies.send(recipient, payload);
        sent += 1;
      } catch (error) {
        const statusCode = getPushStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(recipient.id);
        } else {
          failed += 1;
          dependencies.onTemporaryFailure?.(error, recipient);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (deadIds.length > 0) {
    await dependencies.removeDead(deadIds);
  }

  return {
    dead: deadIds.length,
    failed,
    sent,
    targeted: recipients.length,
  };
}
