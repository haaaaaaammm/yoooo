export type CommentCountKind = "comment" | "reply";

export function getCommentCountLabel(
  count: number,
  kind: CommentCountKind = "comment"
) {
  const plural = kind === "reply" ? "replies" : "comments";

  return `${count} ${count === 1 ? kind : plural}`;
}
