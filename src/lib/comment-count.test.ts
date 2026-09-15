import { describe, expect, it } from "vitest";

import { getCommentCountLabel } from "./comment-count";

describe("getCommentCountLabel", () => {
  it.each([
    { count: 0, label: "0 comments" },
    { count: 1, label: "1 comment" },
    { count: 9, label: "9 comments" },
    { count: 100, label: "100 comments" },
  ])("labels $count accessibly", ({ count, label }) => {
    expect(getCommentCountLabel(count)).toBe(label);
  });

  it.each([
    { count: 0, label: "0 replies" },
    { count: 1, label: "1 reply" },
    { count: 9, label: "9 replies" },
    { count: 100, label: "100 replies" },
  ])("labels $count replies accessibly", ({ count, label }) => {
    expect(getCommentCountLabel(count, "reply")).toBe(label);
  });
});
