import { describe, expect, it } from "vitest";

import { getOtrogatoLoginPath, getSafeOtrogatoPath } from "./posts";
import { parsePageParam } from "./posts";

describe("Otrogato return paths", () => {
  it("accepts only internal Otrogato destinations", () => {
    expect(getSafeOtrogatoPath("/otrogato/post-1")).toBe(
      "/otrogato/post-1"
    );
    expect(
      getSafeOtrogatoPath("/otrogato/post-1?view=thread#comment-2")
    ).toBe("/otrogato/post-1?view=thread#comment-2");
    expect(getSafeOtrogatoPath(["/otrogato?page=2", "/otrogato"])).toBe(
      "/otrogato?page=2"
    );
  });

  it.each([
    "https://evil.example/otrogato/post-1",
    "//evil.example/otrogato/post-1",
    "/diferencias/post-1",
    "/otrogato-evil/post-1",
    "/otrogato\\@evil.example",
    "javascript:alert(1)",
  ])("rejects unsafe return destination %s", (destination) => {
    expect(getSafeOtrogatoPath(destination)).toBeNull();
  });

  it("builds a safely encoded login URL", () => {
    expect(getOtrogatoLoginPath("/otrogato/post-1#comment-2")).toBe(
      "/otrogato?next=%2Fotrogato%2Fpost-1%23comment-2"
    );
    expect(getOtrogatoLoginPath("https://evil.example/otrogato")).toBe(
      "/otrogato"
    );
  });
});

describe("parsePageParam", () => {
  it.each([undefined, "0", "-5", "abc", "999999999999999"])(
    "safely falls back for %s",
    (value) => {
      expect(parsePageParam(value)).toBe(1);
    }
  );

  it("accepts reasonable positive integer pages", () => {
    expect(parsePageParam("30")).toBe(30);
  });
});
