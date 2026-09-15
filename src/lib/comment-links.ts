import { PUBLIC_FEED_PATH, OTROGATO_PATH } from "./posts";

function getCommentAnchor(commentId: string) {
  return `#comment-${encodeURIComponent(commentId)}`;
}

export function getPoemarioCommentCanonicalPath(
  postId: string,
  commentId: string
) {
  return `${PUBLIC_FEED_PATH}/${encodeURIComponent(postId)}${getCommentAnchor(commentId)}`;
}

export function getOtrogatoCommentCanonicalPath(
  postId: string,
  commentId: string
) {
  return `${OTROGATO_PATH}/${encodeURIComponent(postId)}${getCommentAnchor(commentId)}`;
}
