import "server-only";

import {
  addLinkPreviewsToPosts,
  type LinkPreviewData,
} from "./link-previews";
import { addAuthenticatedOtrogatoPreviewsToPosts } from "./otrogato-link-previews";

type CommentWithPreview<T> = T & { preview: LinkPreviewData | null };

function attachPreviewsToComments<T extends { text: string }>(
  comments: T[],
  enrich: typeof addLinkPreviewsToPosts
): Promise<Array<CommentWithPreview<T>>> {
  return enrich(
    comments.map((comment) => ({ comment, content: comment.text }))
  ).then((commentsWithPreviews) =>
    commentsWithPreviews.map(({ comment, preview }) => ({
      ...comment,
      preview,
    }))
  );
}

export function addLinkPreviewsToComments<T extends { text: string }>(
  comments: T[]
) {
  return attachPreviewsToComments(comments, addLinkPreviewsToPosts);
}

export function addAuthenticatedOtrogatoPreviewsToComments<
  T extends { text: string }
>(comments: T[]) {
  return attachPreviewsToComments(
    comments,
    addAuthenticatedOtrogatoPreviewsToPosts
  );
}
