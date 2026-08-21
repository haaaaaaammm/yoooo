import { describe, expect, it, vi } from "vitest";

import {
  createDiferenciasPushPayload,
  dispatchDiferenciasActivityPush,
  type DiferenciasActivity,
  type DiferenciasPushRecipient,
} from "./diferencias-push-core";

function subscription(
  userId: string,
  isActive = true
): DiferenciasPushRecipient {
  return {
    auth: `auth-${userId}`,
    endpoint: `https://push.example.test/${userId}`,
    id: `subscription-${userId}`,
    isActive,
    p256dh: `p256dh-${userId}`,
    userId,
  };
}

const users = [
  subscription("walter"),
  subscription("andrea"),
  subscription("humberto"),
];

async function dispatch(activity: DiferenciasActivity) {
  const targeted: string[] = [];
  const result = await dispatchDiferenciasActivityPush(activity, users, {
    removeDead: vi.fn(async () => undefined),
    send: vi.fn(async (recipient) => {
      targeted.push(recipient.userId);
    }),
  });

  return { result, targeted };
}

describe("Diferencias activity push", () => {
  it("targets Walter, Andrea, and Humberto for Walter's own post", async () => {
    const { result, targeted } = await dispatch({
      actorDisplayName: "Walter",
      content: "hello",
      postId: "post-1",
      type: "post",
    });

    expect(targeted.sort()).toEqual(["andrea", "humberto", "walter"]);
    expect(result).toEqual({ dead: 0, failed: 0, sent: 3, targeted: 3 });
  });

  it("targets everyone for Andrea's comment", async () => {
    const { result, targeted } = await dispatch({
      actorDisplayName: "Andrea",
      commentId: "comment-1",
      content: "a comment",
      postId: "post-1",
      type: "comment",
    });

    expect(targeted).toHaveLength(3);
    expect(result.sent).toBe(3);
  });

  it("targets everyone for Humberto's reply", async () => {
    const { result, targeted } = await dispatch({
      actorDisplayName: "Humberto",
      commentId: "reply-1",
      content: "a reply",
      postId: "post-1",
      type: "reply",
    });

    expect(targeted).toHaveLength(3);
    expect(result.sent).toBe(3);
  });

  it("does not target subscriptions owned by deactivated accounts", async () => {
    const sentUsers: string[] = [];
    const send = vi.fn(async (recipient: DiferenciasPushRecipient) => {
      sentUsers.push(recipient.userId);
    });
    const result = await dispatchDiferenciasActivityPush(
      {
        actorDisplayName: "Walter",
        content: "another post",
        postId: "post-2",
        type: "post",
      },
      [subscription("walter"), subscription("andrea", false)],
      { removeDead: vi.fn(async () => undefined), send }
    );

    expect(send).toHaveBeenCalledOnce();
    expect(sentUsers).toEqual(["walter"]);
    expect(result.targeted).toBe(1);
  });

  it("removes a subscription after a 410 response", async () => {
    const removeDead = vi.fn(async () => undefined);
    const result = await dispatchDiferenciasActivityPush(
      {
        actorDisplayName: "Walter",
        content: "hello",
        postId: "post-1",
        type: "post",
      },
      [subscription("walter")],
      {
        removeDead,
        send: vi.fn(async () => {
          throw { statusCode: 410 };
        }),
      }
    );

    expect(removeDead).toHaveBeenCalledWith(["subscription-walter"]);
    expect(result).toEqual({ dead: 1, failed: 0, sent: 0, targeted: 1 });
  });

  it("isolates a temporary provider failure and continues delivery", async () => {
    const onTemporaryFailure = vi.fn();
    const result = await dispatchDiferenciasActivityPush(
      {
        actorDisplayName: "Walter",
        content: "hello",
        postId: "post-1",
        type: "post",
      },
      users,
      {
        onTemporaryFailure,
        removeDead: vi.fn(async () => undefined),
        send: vi.fn(async (recipient) => {
          if (recipient.userId === "andrea") {
            throw new Error("provider unavailable");
          }
        }),
      }
    );

    expect(result).toEqual({ dead: 0, failed: 1, sent: 2, targeted: 3 });
    expect(onTemporaryFailure).toHaveBeenCalledOnce();
  });

  it("keeps delivery concurrency bounded", async () => {
    let active = 0;
    let peak = 0;
    const manySubscriptions = Array.from({ length: 15 }, (_, index) =>
      subscription(`user-${index}`)
    );

    await dispatchDiferenciasActivityPush(
      {
        actorDisplayName: "Walter",
        content: "hello",
        postId: "post-1",
        type: "post",
      },
      manySubscriptions,
      {
        concurrency: 3,
        removeDead: vi.fn(async () => undefined),
        async send() {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          active -= 1;
        },
      }
    );

    expect(peak).toBeLessThanOrEqual(3);
  });

  it("creates concise internal post and reply payloads", () => {
    const postPayload = createDiferenciasPushPayload({
      actorDisplayName: "Walter",
      content: `  ${"word ".repeat(40)}  `,
      postId: "post-1",
      type: "post",
    });
    const replyPayload = createDiferenciasPushPayload({
      actorDisplayName: "Humberto",
      commentId: "comment-2",
      content: "reply text",
      postId: "post-1",
      type: "reply",
    });

    expect(postPayload.title).toBe("Walter posted");
    expect(postPayload.body.length).toBeLessThanOrEqual(120);
    expect(postPayload.url).toBe("/otrogato/post-1");
    expect(replyPayload).toMatchObject({
      title: "Humberto replied",
      url: "/otrogato/post-1#comment-comment-2",
    });
  });
});
