import { describe, expect, it } from "vitest";

import { getFirstPreviewUrl, getLinkifiedTextParts } from "./text-links";

describe("text links", () => {
  it("uses the same normalized first URL for linkification and previews", () => {
    const text = "listen at www.example.com/song, then https://example.org";
    const link = getLinkifiedTextParts(text).find((part) => part.type === "link");

    expect(link).toMatchObject({ href: "https://www.example.com/song" });
    expect(getFirstPreviewUrl(text)).toBe("https://www.example.com/song");
  });

  it("recognizes known root-relative application URLs", () => {
    expect(getFirstPreviewUrl("quoted /otrogato/private-post")).toBe(
      "https://haaaaaaammmm.com/otrogato/private-post"
    );
  });

  it("previews only the first eligible URL", () => {
    expect(
      getFirstPreviewUrl("https://first.example/a https://second.example/b")
    ).toBe("https://first.example/a");
  });
});
