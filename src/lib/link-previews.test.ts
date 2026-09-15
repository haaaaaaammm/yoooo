import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  fetchExternalLinkPreview: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./link-preview-fetch", () => ({
  fetchExternalLinkPreview: mocks.fetchExternalLinkPreview,
}));
vi.mock("./prisma", () => ({ getPrisma: mocks.getPrisma }));

import {
  addLinkPreviewsToPosts,
  classifyPreviewUrl,
  scheduleLinkPreviewResolution,
} from "./link-previews";

describe("internal link preview classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchExternalLinkPreview.mockResolvedValue({
      description: "Artist",
      imageUrl: "https://is1-ssl.mzstatic.com/art.jpg",
      siteName: "Apple Music",
      title: "Song",
      url: "https://music.apple.com/mx/album/song/1?i=2",
    });
  });
  it("recognizes public Poemario posts", () => {
    expect(
      classifyPreviewUrl(
        "https://haaaaaaammmm.com/nohaydiferenciasentreestoyunpoemario/post-1"
      )
    ).toMatchObject({ id: "post-1", kind: "poemario" });
  });

  it("recognizes public Archivo posts and albums", () => {
    expect(
      classifyPreviewUrl("https://haaaaaaammmm.com/archivo/post-1")
    ).toMatchObject({ id: "post-1", kind: "archivo" });
    expect(
      classifyPreviewUrl("https://haaaaaaammmm.com/archivo/album/album-1")
    ).toMatchObject({ id: "album-1", kind: "archivo" });
  });

  it.each(["otrogato", "diferencias", "yoooo"])(
    "classifies %s as a private generic link without a content identifier",
    (route) => {
      expect(
        classifyPreviewUrl(`https://haaaaaaammmm.com/${route}/private-id`)
      ).toEqual({
        kind: "internal-link",
        private: true,
        url: `https://haaaaaaammmm.com/${route}/private-id`,
      });
    }
  );

  it("never queries private Otrogato content for a preview", async () => {
    mocks.getPrisma.mockReturnValue({});

    await expect(
      addLinkPreviewsToPosts([
        {
          content: "https://haaaaaaammmm.com/otrogato/private-post-id",
        },
      ])
    ).resolves.toEqual([
      {
        content: "https://haaaaaaammmm.com/otrogato/private-post-id",
        preview: {
          kind: "internal-link",
          siteName: "haaaaaaammmm.com",
          title: "private link",
          url: "https://haaaaaaammmm.com/otrogato/private-post-id",
        },
      },
    ]);
  });

  it("renders a public Poemario reference as a one-level repost", async () => {
    mocks.getPrisma.mockReturnValue({
      post: {
        findMany: vi.fn().mockResolvedValue([
          {
            content: "original post with https://nested.example/link",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            customAuthorAvatarUrl: "/avatar.jpg",
            customAuthorName: "Author",
            id: "post-1",
          },
        ]),
      },
      siteSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    const [post] = await addLinkPreviewsToPosts([
      {
        content:
          "quoting https://haaaaaaammmm.com/nohaydiferenciasentreestoyunpoemario/post-1",
      },
    ]);

    expect(post.preview).toMatchObject({
      authorAvatarUrl: "/avatar.jpg",
      authorName: "Author",
      description: "original post with https://nested.example/link",
      kind: "internal-repost",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(post.preview).not.toHaveProperty("preview");
  });

  it("uses a safe fallback when referenced public content was deleted", async () => {
    mocks.getPrisma.mockReturnValue({
      post: { findMany: vi.fn().mockResolvedValue([]) },
      siteSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    const [post] = await addLinkPreviewsToPosts([
      {
        content:
          "https://haaaaaaammmm.com/nohaydiferenciasentreestoyunpoemario/deleted",
      },
    ]);

    expect(post.preview).toEqual({
      kind: "unavailable",
      url: "https://haaaaaaammmm.com/nohaydiferenciasentreestoyunpoemario/deleted",
    });
  });

  it("does not treat lookalike domains as internal", () => {
    expect(
      classifyPreviewUrl("https://haaaaaaammmm.com.evil.example/otrogato/id")
    ).toMatchObject({ kind: "external" });
  });

  it("retries an Apple Music failure from the previous resolver version", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    mocks.getPrisma.mockReturnValue({
      linkPreview: {
        findMany: vi.fn().mockResolvedValue([
          {
            fetchedAt: new Date(),
            status: "failed",
            urlHash:
              "f6f3316d9c445115f9343d90b17f4b331f28a287d880e927ebcc17300a60311d",
          },
        ]),
        upsert,
      },
    });

    scheduleLinkPreviewResolution(
      "https://music.apple.com/mx/album/song/1?i=2"
    );
    const scheduledWork = mocks.after.mock.calls[0]?.[0];
    await scheduledWork?.();

    expect(mocks.fetchExternalLinkPreview).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "ready:apple-v3" }),
      })
    );
  });
});
