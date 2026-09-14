export function getCommentCountLabel(count: number) {
  return `${count} ${count === 1 ? "comment" : "comments"}`;
}
