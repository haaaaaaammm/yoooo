import { describe, expect, it } from "vitest";

import {
  COMMENT_THREAD_MAX_DESKTOP_VISUAL_DEPTH,
  COMMENT_THREAD_MAX_MOBILE_VISUAL_DEPTH,
  getCommentThreadNodeClassName,
} from "./comment-thread-layout";

describe("comment thread visual indentation", () => {
  it("indents only the first two reply levels on mobile", () => {
    expect(COMMENT_THREAD_MAX_MOBILE_VISUAL_DEPTH).toBe(2);
    expect(getCommentThreadNodeClassName(1)).toContain("pl-3");
    expect(getCommentThreadNodeClassName(2)).toContain("pl-3");
    expect(getCommentThreadNodeClassName(3)).not.toMatch(/(^|\s)pl-3(\s|$)/);
    expect(getCommentThreadNodeClassName(20)).not.toMatch(/(^|\s)pl-3(\s|$)/);
  });

  it("adds at most two more reply indents on larger screens", () => {
    expect(COMMENT_THREAD_MAX_DESKTOP_VISUAL_DEPTH).toBe(4);
    expect(getCommentThreadNodeClassName(3)).toContain("sm:pl-3");
    expect(getCommentThreadNodeClassName(4)).toContain("sm:pl-3");
    expect(getCommentThreadNodeClassName(5)).not.toContain("sm:pl-3");
    expect(getCommentThreadNodeClassName(20)).not.toContain("sm:pl-3");
  });

  it("keeps every logical depth width-constrained without changing it", () => {
    for (const depth of [0, 1, 2, 3, 4, 5, 20, 50]) {
      const className = getCommentThreadNodeClassName(depth);

      expect(className).toContain("min-w-0");
      expect(className).toContain("max-w-full");
    }
  });
});
