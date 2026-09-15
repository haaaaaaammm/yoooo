import { describe, expect, it } from "vitest";

import { getPostOptionItems } from "./post-options";

describe("getPostOptionItems", () => {
  it("only exposes Copy link to a public visitor or non-owner", () => {
    expect(getPostOptionItems({ canDelete: false, canEdit: false })).toEqual([
      "copy",
    ]);
  });

  it("adds the existing edit and delete capabilities for an owner/admin", () => {
    expect(getPostOptionItems({ canDelete: true, canEdit: true })).toEqual([
      "copy",
      "edit",
      "delete",
    ]);
  });
});
