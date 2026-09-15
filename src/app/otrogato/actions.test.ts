import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  getDiferenciasSessionUser: vi.fn(),
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
  scheduleLinkPreviewResolution: vi.fn(),
}));
vi.mock("@/lib/posts", () => ({
  DIFERENCIAS_COMMENT_MAX_LENGTH: 10_000,
  DIFERENCIAS_CONTENT_MAX_LENGTH: 20_000,
  getSafeOtrogatoPath: vi.fn(),
  OTROGATO_PATH: "/otrogato",
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    diferenciasPost: {
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
    },
  }),
}));
vi.mock("@/lib/r2", () => ({
  deleteR2Object: vi.fn(),
  uploadDiferenciasAvatarToR2: vi.fn(),
  validateProfileImageFile: vi.fn(),
}));

import { deletePostAction, updatePostAction } from "./actions";

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
