import { describe, expect, it } from "vitest";

import { getPoemarioPostBodyClassName } from "./poemario-post-body";

describe("Poemario post body blink styling", () => {
  it("adds the shared blink class when the persisted value is true", () => {
    expect(getPoemarioPostBodyClassName(true)).toBe(
      "mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100 poemario-blink"
    );
  });

  it("keeps normal body styling when the persisted value is false", () => {
    expect(getPoemarioPostBodyClassName(false)).toBe(
      "mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100"
    );
  });
});
