import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commentCreate: vi.fn(),
  commentDelete: vi.fn(),
  commentFindUnique: vi.fn(),
  commentUpdate: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  postFindUnique: vi.fn(),
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
    post: { findUnique: mocks.postFindUnique },
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
  createPoemarioCommentAction,
  deletePoemarioCommentAction,
  updatePoemarioCommentAction,
} from "./actions";

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
