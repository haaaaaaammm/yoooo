import { describe, expect, it } from "vitest";

import { getPaginationHref, getPaginationItems } from "./pagination";

describe("getPaginationItems", () => {
  it("keeps the beginning of a 30-page collection bounded", () => {
    expect(getPaginationItems(1, 30)).toEqual([1, 2, 3, "ellipsis", 30]);
  });

  it("keeps the middle of a 30-page collection bounded", () => {
    expect(getPaginationItems(15, 30)).toEqual([
      1,
      "ellipsis",
      14,
      15,
      16,
      "ellipsis",
      30,
    ]);
  });

  it("keeps the end of a 30-page collection bounded", () => {
    expect(getPaginationItems(30, 30)).toEqual([
      1,
      "ellipsis",
      28,
      29,
      30,
    ]);
  });

  it("uses fewer numeric buttons for mobile", () => {
    expect(getPaginationItems(15, 30, 0)).toEqual([
      1,
      "ellipsis",
      15,
      "ellipsis",
      30,
    ]);
  });

  it("clamps invalid current pages", () => {
    expect(getPaginationItems(0, 30)).toEqual([1, 2, 3, "ellipsis", 30]);
    expect(getPaginationItems(31, 30)).toEqual([
      1,
      "ellipsis",
      28,
      29,
      30,
    ]);
  });
});

describe("getPaginationHref", () => {
  it("preserves unrelated query parameters while replacing page", () => {
    expect(getPaginationHref("/yoooo?app=archivo&filter=photos&page=2", 3)).toBe(
      "/yoooo?app=archivo&filter=photos&page=3"
    );
  });
});
