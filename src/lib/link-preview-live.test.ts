import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchExternalLinkPreview } from "./link-preview-fetch";

const liveUrl = process.env.LINK_PREVIEW_LIVE_URL;

describe.skipIf(!liveUrl)("live link preview diagnostic", () => {
  it(
    "fetches useful standards-based metadata",
    async () => {
      const metadata = await fetchExternalLinkPreview(liveUrl!);

      expect(metadata.title).toBeTruthy();
      expect(metadata.siteName || new URL(metadata.url).hostname).toBeTruthy();

      if (process.env.LINK_PREVIEW_REQUIRE_RICH === "1") {
        expect(metadata.description).toBeTruthy();
        expect(metadata.imageUrl).toMatch(/^https?:\/\//);
      }

      if (process.env.LINK_PREVIEW_EXPECT_TITLE) {
        expect(metadata.title).toBe(process.env.LINK_PREVIEW_EXPECT_TITLE);
      }

      if (process.env.LINK_PREVIEW_EXPECT_DESCRIPTION) {
        expect(metadata.description).toBe(
          process.env.LINK_PREVIEW_EXPECT_DESCRIPTION
        );
      }

      if (process.env.LINK_PREVIEW_EXPECT_SITE_NAME) {
        expect(metadata.siteName).toBe(
          process.env.LINK_PREVIEW_EXPECT_SITE_NAME
        );
      }
    },
    15_000
  );
});
