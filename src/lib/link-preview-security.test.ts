import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BoundedHtmlHeadReader,
  fetchExternalLinkPreview,
  parseAppleMusicMetadata,
  parseLinkPreviewHtml,
  resolveLinkPreviewMetadata,
} from "./link-preview-fetch";
import {
  isPublicIpAddress,
  validateExternalPreviewUrl,
} from "./link-preview-security";

const publicResolver = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 as const },
]);

describe("link preview SSRF protection", () => {
  it("stops after the HTML head without reading a large page body", () => {
    const reader = new BoundedHtmlHeadReader();

    expect(
      reader.append(
        Buffer.from("<html><head><title>Safe preview</title></head>")
      )
    ).toBe("<html><head><title>Safe preview</title></head>");
  });

  it("still rejects non-Apple HTML that exceeds the 256 KiB ceiling", () => {
    const reader = new BoundedHtmlHeadReader();

    expect(reader.append(Buffer.alloc(256 * 1024, "a"))).toBeNull();
    expect(() => reader.append(Buffer.from("b"))).toThrow(
      "Link preview response is too large."
    );
  });

  it.each([
    "127.0.0.1",
    "127.1",
    "::1",
    "169.254.169.254",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "0.0.0.0",
    "224.0.0.1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each([
    "http://127.0.0.1",
    "http://2130706433",
    "http://0177.0.0.1",
    "http://[::1]",
    "http://169.254.169.254",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://localhost",
    "http://metadata.google.internal",
    "file:///etc/passwd",
    "https://user:password@example.com",
    "https://example.com:8080",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validateExternalPreviewUrl(url, publicResolver)).rejects.toThrow();
  });

  it("rejects a public hostname if any DNS result is private", async () => {
    await expect(
      validateExternalPreviewUrl("https://public.example.org", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ])
    ).rejects.toThrow("not public");
  });

  it("validates every redirect before requesting it", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        location: "http://127.0.0.1/private",
        status: 302,
      });

    await expect(
      fetchExternalLinkPreview("https://public.example.org", {
        request,
        resolveAddresses: publicResolver,
      })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when the bounded request times out", async () => {
    await expect(
      fetchExternalLinkPreview("https://public.example.org", {
        request: async () => {
          throw new Error("Link preview request timed out.");
        },
        resolveAddresses: publicResolver,
      })
    ).rejects.toThrow("timed out");
  });
});

describe("link preview metadata", () => {
  it("extracts Open Graph metadata without rendering HTML", () => {
    const metadata = parseLinkPreviewHtml(
      `<html><head>
        <meta property="og:title" content="Song Name">
        <meta property="og:description" content="Artist Name">
        <meta property="og:site_name" content="Apple Music">
        <meta property="og:image" content="/artwork.jpg">
      </head></html>`,
      "https://music.apple.com/us/song/example/1"
    );

    expect(metadata).toEqual({
      description: "Artist Name",
      imageUrl: "https://music.apple.com/artwork.jpg",
      siteName: "Apple Music",
      title: "Song Name",
    });
  });

  it("falls back to title and description metadata", () => {
    expect(
      parseLinkPreviewHtml(
        '<html><head><title>Simple page</title><meta name="description" content="Summary"></head></html>',
        "https://example.org"
      )
    ).toMatchObject({
      description: "Summary",
      imageUrl: null,
      siteName: null,
      title: "Simple page",
    });
  });

  it("normalizes and bounds untrusted metadata", () => {
    const metadata = parseLinkPreviewHtml(
      `<title>${"x".repeat(500)}</title>`,
      "https://example.org"
    );

    expect(metadata.title).toHaveLength(200);
  });

  it("uses Apple Music JSON-LD for a clean song card", () => {
    const metadata = parseAppleMusicMetadata(
      `<html><head>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "MusicComposition",
          audio: {
            "@type": "MusicRecording",
            byArtist: [
              { "@type": "MusicGroup", name: "First Artist" },
              { "@type": "MusicGroup", name: "Second Artist" },
            ],
            image: "/wide-art.jpg",
            name: "Encoded Song & More",
          },
          inAlbum: { image: "/square-art.png", name: "Album Name" },
          name: "Encoded Song & More",
        })}</script>
      </head></html>`,
      "https://music.apple.com/mx/album/encoded-song/123?i=456&l=en-GB"
    );

    expect(metadata).toEqual({
      description: "First Artist & Second Artist",
      imageUrl: "https://music.apple.com/square-art.png",
      siteName: "Apple Music",
      title: "Encoded Song & More",
    });
  });

  it("supports an Apple Music album share URL without a track query", () => {
    expect(
      parseAppleMusicMetadata(
        `<script type="application/ld+json">${JSON.stringify({
          "@type": "MusicAlbum",
          byArtist: { "@type": "MusicGroup", name: "Album Artist" },
          image: "https://is1-ssl.mzstatic.com/artwork.png",
          name: "Shared Album",
        })}</script>`,
        "https://music.apple.com/us/album/shared-album/789"
      )
    ).toEqual({
      description: "Album Artist",
      imageUrl: "https://is1-ssl.mzstatic.com/artwork.png",
      siteName: "Apple Music",
      title: "Shared Album",
    });
  });

  it("falls back to Open Graph when Apple JSON-LD is unavailable", () => {
    expect(
      resolveLinkPreviewMetadata(
        `<meta property="og:title" content="Fallback Song">
         <meta property="og:description" content="Fallback Artist">
         <meta property="og:site_name" content="Apple Music">`,
        "https://music.apple.com/gb/song/fallback/987"
      )
    ).toMatchObject({
      description: "Fallback Artist",
      siteName: "Apple Music",
      title: "Fallback Song",
    });
  });
});
