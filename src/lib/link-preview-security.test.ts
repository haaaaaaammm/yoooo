import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchExternalLinkPreview, parseLinkPreviewHtml } from "./link-preview-fetch";
import {
  isPublicIpAddress,
  validateExternalPreviewUrl,
} from "./link-preview-security";

const publicResolver = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 as const },
]);

describe("link preview SSRF protection", () => {
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
});
