import { describe, expect, it } from "vitest";

import {
  getOtrogatoCommentCanonicalPath,
  getPoemarioCommentCanonicalPath,
} from "./comment-links";

describe("comment canonical links", () => {
  it("uses the public Poemario post route plus a stable comment anchor", () => {
    expect(getPoemarioCommentCanonicalPath("post id", "reply/id")).toBe(
      "/nohaydiferenciasentreestoyunpoemario/post%20id#comment-reply%2Fid"
    );
  });

  it("uses Otrogato and never resurrects the retired Diferencias route", () => {
    const path = getOtrogatoCommentCanonicalPath("post id", "reply/id");

    expect(path).toBe("/otrogato/post%20id#comment-reply%2Fid");
    expect(path).not.toContain("/diferencias/");
  });
});
