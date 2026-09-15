import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("./otrogato-link-previews", () => ({
  addAuthenticatedOtrogatoPreviewsToPosts: vi.fn(),
}));

import { addLinkPreviewsToComments } from "./comment-link-previews";

const APPLE_URL =
  "https://music.apple.com/mx/album/bohemian-rhapsody/6781027361?i=6781027645";

describe("Apple Music previews in comments and nested replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue({
      linkPreview: {
        findMany: vi.fn().mockResolvedValue([
          {
            description: "Queen",
            fetchedAt: new Date(),
            imageUrl: "https://is1-ssl.mzstatic.com/image/thumb/artwork.jpg",
            siteName: "Apple Music",
            status: "ready:apple-v3",
            title: "Bohemian Rhapsody",
            url: APPLE_URL,
            urlHash: createHash("sha256").update(APPLE_URL).digest("hex"),
          },
        ]),
      },
    });
  });

  it("reuses the post cache card data at any logical reply depth", async () => {
    const [reply] = await addLinkPreviewsToComments([
      {
        depth: 4,
        id: "deep-reply",
        text: `${APPLE_URL} https://second.example/ignored`,
      },
    ]);

    expect(reply).toMatchObject({
      depth: 4,
      id: "deep-reply",
      preview: {
        description: "Queen",
        imageUrl: expect.stringMatching(/^https:\/\//),
        kind: "external",
        siteName: "Apple Music",
        title: "Bohemian Rhapsody",
        url: APPLE_URL,
      },
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("keeps a private Otrogato URL generic in a public comment context", async () => {
    mocks.getPrisma.mockReturnValue({});

    const [comment] = await addLinkPreviewsToComments([
      {
        id: "public-comment",
        text: "/otrogato/private-post#comment-private-reply",
      },
    ]);

    expect(comment.preview).toEqual({
      kind: "internal-link",
      siteName: "haaaaaaammmm.com",
      title: "private link",
      url: "https://haaaaaaammmm.com/otrogato/private-post#comment-private-reply",
    });
    expect(JSON.stringify(comment)).not.toContain("private post body");
  });
});
