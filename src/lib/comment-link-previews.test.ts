import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAuthenticatedOtrogatoPreviewsToPosts: vi.fn(),
  addLinkPreviewsToPosts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./link-previews", () => ({
  addLinkPreviewsToPosts: mocks.addLinkPreviewsToPosts,
}));
vi.mock("./otrogato-link-previews", () => ({
  addAuthenticatedOtrogatoPreviewsToPosts:
    mocks.addAuthenticatedOtrogatoPreviewsToPosts,
}));

import {
  addAuthenticatedOtrogatoPreviewsToComments,
  addLinkPreviewsToComments,
} from "./comment-link-previews";

const comments = [
  { id: "comment-1", text: "https://example.com/one" },
  { id: "comment-2", text: "/otrogato/post-2#comment-reply-2" },
  { id: "comment-3", text: "plain text" },
];

describe("comment link preview batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches a complete public thread in one batched resolver call", async () => {
    mocks.addLinkPreviewsToPosts.mockImplementation(async (items) =>
      items.map((item: { comment: (typeof comments)[number] }) => ({
        ...item,
        preview: { kind: "external", url: "https://example.com/one" },
      }))
    );

    const result = await addLinkPreviewsToComments(comments);

    expect(mocks.addLinkPreviewsToPosts).toHaveBeenCalledOnce();
    expect(mocks.addLinkPreviewsToPosts).toHaveBeenCalledWith(
      comments.map((comment) => ({ comment, content: comment.text }))
    );
    expect(result.map(({ id }) => id)).toEqual([
      "comment-1",
      "comment-2",
      "comment-3",
    ]);
  });

  it("uses the authenticated batched resolver for a complete Otrogato thread", async () => {
    mocks.addAuthenticatedOtrogatoPreviewsToPosts.mockImplementation(
      async (items) =>
        items.map((item: { comment: (typeof comments)[number] }) => ({
          ...item,
          preview: null,
        }))
    );

    await addAuthenticatedOtrogatoPreviewsToComments(comments);

    expect(
      mocks.addAuthenticatedOtrogatoPreviewsToPosts
    ).toHaveBeenCalledOnce();
    expect(mocks.addLinkPreviewsToPosts).not.toHaveBeenCalled();
  });
});
