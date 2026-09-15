import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commentCreate: vi.fn(),
  commentDelete: vi.fn(),
  commentFindUnique: vi.fn(),
  commentUpdate: vi.fn(),
  deleteMany: vi.fn(),
  getDiferenciasSessionUser: vi.fn(),
  postFindUnique: vi.fn(),
  scheduleLinkPreviewResolution: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/diferencias-auth", () => ({
  getDiferenciasLoginIp: vi.fn(),
  getDiferenciasSessionUser: mocks.getDiferenciasSessionUser,
  loginDiferenciasUser: vi.fn(),
  logoutDiferenciasUser: vi.fn(),
}));
vi.mock("@/lib/diferencias-push", () => ({
  sendDiferenciasActivityPush: vi.fn(),
}));
vi.mock("@/lib/link-previews", () => ({
  scheduleLinkPreviewResolution: mocks.scheduleLinkPreviewResolution,
}));
vi.mock("@/lib/posts", () => ({
  DIFERENCIAS_COMMENT_MAX_LENGTH: 10_000,
  DIFERENCIAS_CONTENT_MAX_LENGTH: 20_000,
  getSafeOtrogatoPath: vi.fn(),
  OTROGATO_PATH: "/otrogato",
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    diferenciasComment: {
      create: mocks.commentCreate,
      delete: mocks.commentDelete,
      findUnique: mocks.commentFindUnique,
      update: mocks.commentUpdate,
    },
    diferenciasPost: {
      deleteMany: mocks.deleteMany,
      findUnique: mocks.postFindUnique,
      updateMany: mocks.updateMany,
    },
  }),
}));
vi.mock("@/lib/r2", () => ({
  deleteR2Object: vi.fn(),
  uploadDiferenciasAvatarToR2: vi.fn(),
  validateProfileImageFile: vi.fn(),
}));

import {
  createCommentAction,
  deleteCommentAction,
  deletePostAction,
  updateCommentAction,
  updatePostAction,
} from "./actions";

describe("Otrogato post ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDiferenciasSessionUser.mockResolvedValue({
      displayName: "Andrea",
      id: "andrea-id",
    });
  });

  it("rejects Andrea's direct edit attempt against Walter's post", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updatePostAction("walter-post-id", "unauthorized edit")
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      data: { content: "unauthorized edit" },
      where: { authorId: "andrea-id", id: "walter-post-id" },
    });
  });

  it("rejects Andrea's direct delete attempt against Walter's post", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deletePostAction("walter-post-id")).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { authorId: "andrea-id", id: "walter-post-id" },
    });
  });

  it("rejects direct edit and delete attempts without a session", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue(null);

    await expect(
      updatePostAction("walter-post-id", "unauthenticated edit")
    ).resolves.toMatchObject({ ok: false });
    await expect(deletePostAction("walter-post-id")).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("retains Walter's existing owner update capability", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue({
      displayName: "Walter",
      id: "walter-id",
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      updatePostAction("walter-post-id", "owner edit")
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("Otrogato comment ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDiferenciasSessionUser.mockResolvedValue({
      displayName: "Andrea",
      id: "andrea-id",
    });
  });

  it.each(["walter-comment-id", "walter-nested-reply-id"])(
    "rejects Andrea's direct edit and delete attempts against %s",
    async (commentId) => {
      mocks.commentFindUnique.mockResolvedValue(null);

      await expect(
        updateCommentAction(commentId, "unauthorized edit")
      ).resolves.toMatchObject({ ok: false });
      await expect(deleteCommentAction(commentId)).resolves.toMatchObject({
        ok: false,
      });

      expect(mocks.commentFindUnique).toHaveBeenCalledWith({
        select: { postId: true },
        where: { authorId: "andrea-id", id: commentId },
      });
      expect(mocks.commentUpdate).not.toHaveBeenCalled();
      expect(mocks.commentDelete).not.toHaveBeenCalled();
    }
  );

  it("rejects direct comment mutations without a session", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue(null);

    await expect(
      updateCommentAction("comment-id", "unauthenticated edit")
    ).resolves.toMatchObject({ ok: false });
    await expect(deleteCommentAction("comment-id")).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.commentFindUnique).not.toHaveBeenCalled();
  });

  it("retains the owner's edit and delete capabilities", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue({
      displayName: "Walter",
      id: "walter-id",
    });
    mocks.commentFindUnique.mockResolvedValue({ postId: "post-id" });
    mocks.commentUpdate.mockResolvedValue({});
    mocks.commentDelete.mockResolvedValue({});

    await expect(
      updateCommentAction("comment-id", "owner edit")
    ).resolves.toMatchObject({ ok: true });
    await expect(deleteCommentAction("comment-id")).resolves.toMatchObject({
      ok: true,
    });

    expect(mocks.commentUpdate).toHaveBeenCalledWith({
      data: { text: "owner edit" },
      where: { authorId: "walter-id", id: "comment-id" },
    });
    expect(mocks.commentDelete).toHaveBeenCalledWith({
      where: { authorId: "walter-id", id: "comment-id" },
    });
    expect(mocks.scheduleLinkPreviewResolution).toHaveBeenCalledWith(
      "owner edit"
    );
  });

  it("schedules the first-link preview after creating a comment", async () => {
    mocks.postFindUnique.mockResolvedValue({ id: "post-id" });
    mocks.commentCreate.mockResolvedValue({ id: "comment-id" });

    await expect(
      createCommentAction("post-id", null, "https://example.com/new")
    ).resolves.toMatchObject({ ok: true });

    expect(mocks.scheduleLinkPreviewResolution).toHaveBeenCalledWith(
      "https://example.com/new"
    );
  });
});
