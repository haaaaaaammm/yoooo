import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  findMany: vi.fn(),
  getDiferenciasSessionUser: vi.fn(),
  getPrisma: vi.fn(),
  linkPreviewUpsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./diferencias-auth", () => ({
  getDiferenciasSessionUser: mocks.getDiferenciasSessionUser,
}));
vi.mock("./link-preview-fetch", () => ({
  fetchExternalLinkPreview: vi.fn(),
}));
vi.mock("./prisma", () => ({ getPrisma: mocks.getPrisma }));

import { addAuthenticatedOtrogatoPreviewsToPosts } from "./otrogato-link-previews";

const referencedPost = {
  _count: { comments: 4 },
  author: { avatarUrl: "/andrea.jpg", displayName: "Andrea" },
  content: "Andrea's private original with /otrogato/nested-post",
  createdAt: new Date("2026-09-14T12:00:00.000Z"),
  id: "andrea-post",
};

describe("authenticated Otrogato link previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue({
      diferenciasPost: { findMany: mocks.findMany },
      linkPreview: { upsert: mocks.linkPreviewUpsert },
    });
    mocks.findMany.mockResolvedValue([referencedPost]);
  });

  it.each([
    { displayName: "Walter", id: "walter-id" },
    { displayName: "Andrea", id: "andrea-id" },
  ])("shows Andrea's post to authenticated $displayName", async (user) => {
    mocks.getDiferenciasSessionUser.mockResolvedValue(user);

    const [post] = await addAuthenticatedOtrogatoPreviewsToPosts([
      {
        content:
          "quoting https://haaaaaaammmm.com/otrogato/andrea-post?from=feed#reply",
      },
    ]);

    expect(post.preview).toEqual({
      authorAvatarUrl: "/andrea.jpg",
      authorName: "Andrea",
      commentCount: 4,
      description: "Andrea's private original with /otrogato/nested-post",
      kind: "internal-repost",
      publishedAt: "2026-09-14T12:00:00.000Z",
      siteName: "otrogato",
      url: "https://haaaaaaammmm.com/otrogato/andrea-post",
    });
    expect(post.preview).not.toHaveProperty("preview");
    expect(mocks.findMany).toHaveBeenCalledOnce();
    expect(mocks.linkPreviewUpsert).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith({
      select: {
        _count: { select: { comments: true } },
        author: { select: { avatarUrl: true, displayName: true } },
        content: true,
        createdAt: true,
        id: true,
      },
      where: { id: { in: ["andrea-post"] } },
    });
    expect(
      mocks.getDiferenciasSessionUser.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.findMany.mock.invocationCallOrder[0]);
  });

  it.each(["logged out", "forged", "expired", "inactive"])(
    "does not query or expose private content for a $label session",
    async () => {
      mocks.getDiferenciasSessionUser.mockResolvedValue(null);

      const [post] = await addAuthenticatedOtrogatoPreviewsToPosts([
        { content: "/otrogato/andrea-post" },
      ]);

      expect(mocks.findMany).not.toHaveBeenCalled();
      expect(post.preview).toEqual({
        kind: "internal-link",
        siteName: "haaaaaaammmm.com",
        title: "private link",
        url: "https://haaaaaaammmm.com/otrogato/andrea-post",
      });
      expect(JSON.stringify(post)).not.toContain(referencedPost.content);
    }
  );

  it("batch-loads multiple referenced posts in one query", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue({ id: "walter-id" });
    mocks.findMany.mockResolvedValue([
      referencedPost,
      { ...referencedPost, id: "second-post" },
    ]);

    await addAuthenticatedOtrogatoPreviewsToPosts([
      { content: "/otrogato/andrea-post" },
      { content: "/otrogato/second-post" },
      { content: "/otrogato/andrea-post" },
    ]);

    expect(mocks.findMany).toHaveBeenCalledOnce();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["andrea-post", "second-post"] } },
      })
    );
  });

  it("renders the private unavailable fallback for a deleted post", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue({ id: "andrea-id" });
    mocks.findMany.mockResolvedValue([]);

    const [post] = await addAuthenticatedOtrogatoPreviewsToPosts([
      { content: "/otrogato/deleted-post" },
    ]);

    expect(post.preview).toEqual({
      kind: "unavailable",
      url: "https://haaaaaaammmm.com/otrogato/deleted-post",
    });
  });

  it("preserves first-link-only behavior", async () => {
    mocks.getDiferenciasSessionUser.mockResolvedValue({ id: "andrea-id" });
    mocks.getPrisma.mockReturnValue({
      post: { findMany: vi.fn().mockResolvedValue([]) },
      siteSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    await addAuthenticatedOtrogatoPreviewsToPosts([
      {
        content:
          "/nohaydiferenciasentreestoyunpoemario/public-first /otrogato/andrea-post",
      },
    ]);

    expect(mocks.getDiferenciasSessionUser).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
