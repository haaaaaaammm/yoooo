import { describe, expect, it } from "vitest";

import { getCommentCountLabel } from "./comment-count";

describe("getCommentCountLabel", () => {
  it.each([
    { count: 0, label: "0 comments" },
    { count: 1, label: "1 comment" },
    { count: 7, label: "7 comments" },
  ])("labels $count accessibly", ({ count, label }) => {
    expect(getCommentCountLabel(count)).toBe(label);
  });
});
