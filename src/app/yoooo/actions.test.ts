import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commentCreate: vi.fn(),
  commentDelete: vi.fn(),
  commentFindUnique: vi.fn(),
  commentUpdate: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  postCreate: vi.fn(),
  postFindUnique: vi.fn(),
  postUpdate: vi.fn(),
  scheduleLinkPreviewResolution: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/archivo", () => ({
  ARCHIVO_ALBUM_KIND: "album",
  ARCHIVO_IMAGE_MAX_SIZE_BYTES: 10_000_000,
  ARCHIVO_POST_KIND: "post",
  formatArchivoFileSize: vi.fn(),
  getArchivoImageFileInfo: vi.fn(),
  parseArchivoTakenAt: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  isAdminAuthenticated: mocks.isAdminAuthenticated,
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
}));
vi.mock("@/lib/link-previews", () => ({
  scheduleLinkPreviewResolution: mocks.scheduleLinkPreviewResolution,
}));
vi.mock("@/lib/posts", () => ({
  ADMIN_PATH: "/yoooo",
  ARCHIVO_PATH: "/archivo",
  PUBLIC_FEED_PATH: "/nohaydiferenciasentreestoyunpoemario",
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    poemarioComment: {
      create: mocks.commentCreate,
      delete: mocks.commentDelete,
      findUnique: mocks.commentFindUnique,
      update: mocks.commentUpdate,
    },
    post: {
      create: mocks.postCreate,
      findUnique: mocks.postFindUnique,
      update: mocks.postUpdate,
    },
  }),
}));
vi.mock("@/lib/r2", () => ({
  deleteR2Object: vi.fn(),
  uploadArchivoImageToR2: vi.fn(),
  uploadPoemarioAvatarToR2: vi.fn(),
  uploadProfileImageToR2: vi.fn(),
  validateImageFile: vi.fn(),
  validateProfileImageFile: vi.fn(),
}));
vi.mock("@/lib/site-settings", () => ({ SITE_SETTINGS_ID: "default" }));

import {
  createPostAction,
  createPoemarioCommentAction,
  deletePoemarioCommentAction,
  updatePostAction,
  updatePoemarioCommentAction,
} from "./actions";

describe("Poemario post blink setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdminAuthenticated.mockResolvedValue(true);
  });

  it("stores false by default and true when parpadeo is checked", async () => {
    const normalPost = new FormData();
    normalPost.set("content", "normal");
    const blinkingPost = new FormData();
    blinkingPost.set("content", "blinking");
    blinkingPost.set("blink", "on");

    await createPostAction(normalPost);
    await createPostAction(blinkingPost);

    expect(mocks.postCreate).toHaveBeenNthCalledWith(1, {
      data: { blink: false, content: "normal" },
    });
    expect(mocks.postCreate).toHaveBeenNthCalledWith(2, {
      data: { blink: true, content: "blinking" },
    });
  });

  it("changes an existing post from blink=false to blink=true", async () => {
    mocks.postFindUnique.mockResolvedValue({ id: "post-id", blink: false });
    mocks.postUpdate.mockResolvedValue({
      blink: true,
      content: "same content",
    });

    await expect(
      updatePostAction("post-id", "same content", true)
    ).resolves.toEqual({ blink: true, content: "same content", ok: true });
    expect(mocks.postUpdate).toHaveBeenCalledWith({
      data: { blink: true, content: "same content" },
      select: { blink: true, content: true },
      where: { id: "post-id" },
    });
  });

  it("changes an existing post from blink=true to blink=false", async () => {
    mocks.postFindUnique.mockResolvedValue({ id: "post-id", blink: true });
    mocks.postUpdate.mockResolvedValue({
      blink: false,
      content: "same content",
    });

    await expect(
      updatePostAction("post-id", "same content", false)
    ).resolves.toEqual({ blink: false, content: "same content", ok: true });
    expect(mocks.postUpdate).toHaveBeenCalledWith({
      data: { blink: false, content: "same content" },
      select: { blink: true, content: true },
      where: { id: "post-id" },
    });
  });

  it("returns the blink value persisted by the database", async () => {
    mocks.postFindUnique.mockResolvedValue({ id: "post-id" });
    mocks.postUpdate.mockResolvedValue({
      blink: false,
      content: "database content",
    });

    await expect(
      updatePostAction("post-id", "submitted content", true)
    ).resolves.toEqual({
      blink: false,
      content: "database content",
      ok: true,
    });
  });

  it("rejects a non-boolean update value", async () => {
    await expect(
      updatePostAction("post-id", "content", "on" as unknown as boolean)
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(mocks.postFindUnique).not.toHaveBeenCalled();
    expect(mocks.postUpdate).not.toHaveBeenCalled();
  });
});

describe("Poemario comment server-action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects direct create, edit, and delete calls without admin auth", async () => {
    mocks.isAdminAuthenticated.mockResolvedValue(false);

    await expect(
      createPoemarioCommentAction("post-id", null, "new comment")
    ).resolves.toMatchObject({ ok: false });
    await expect(
      updatePoemarioCommentAction("comment-id", "edited")
    ).resolves.toMatchObject({ ok: false });
    await expect(
      deletePoemarioCommentAction("comment-id")
    ).resolves.toMatchObject({ ok: false });

    expect(mocks.postFindUnique).not.toHaveBeenCalled();
    expect(mocks.commentFindUnique).not.toHaveBeenCalled();
    expect(mocks.commentCreate).not.toHaveBeenCalled();
    expect(mocks.commentUpdate).not.toHaveBeenCalled();
    expect(mocks.commentDelete).not.toHaveBeenCalled();
  });

  it("schedules preview resolution after an authorized create and edit", async () => {
    mocks.isAdminAuthenticated.mockResolvedValue(true);
    mocks.postFindUnique.mockResolvedValue({ id: "post-id" });
    mocks.commentCreate.mockResolvedValue({});
    mocks.commentFindUnique.mockResolvedValue({ postId: "post-id" });
    mocks.commentUpdate.mockResolvedValue({});

    await expect(
      createPoemarioCommentAction(
        "post-id",
        null,
        "https://example.com/new"
      )
    ).resolves.toMatchObject({ ok: true });
    await expect(
      updatePoemarioCommentAction("comment-id", "/archivo/post-1")
    ).resolves.toMatchObject({ ok: true });

    expect(mocks.scheduleLinkPreviewResolution).toHaveBeenNthCalledWith(
      1,
      "https://example.com/new"
    );
    expect(mocks.scheduleLinkPreviewResolution).toHaveBeenNthCalledWith(
      2,
      "/archivo/post-1"
    );
  });
});
