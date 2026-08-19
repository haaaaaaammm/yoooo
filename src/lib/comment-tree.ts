export type CommentRecord = {
  id: string;
  parentId: string | null;
};

export type CommentTreeNode<T extends CommentRecord> = T & {
  replies: CommentTreeNode<T>[];
};

export function buildCommentTreeWithMap<T extends CommentRecord>(
  comments: T[]
) {
  const commentMap = new Map<string, CommentTreeNode<T>>();
  const roots: CommentTreeNode<T>[] = [];

  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  comments.forEach((comment) => {
    const node = commentMap.get(comment.id);

    if (!node) {
      return;
    }

    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);

      if (parent) {
        parent.replies.push(node);
        return;
      }
    }

    roots.push(node);
  });

  return { commentMap, roots };
}

export function buildCommentTree<T extends CommentRecord>(comments: T[]) {
  return buildCommentTreeWithMap(comments).roots;
}

export function getCommentAncestorChain<T extends CommentRecord>(
  comment: CommentTreeNode<T>,
  commentMap: Map<string, CommentTreeNode<T>>
) {
  const ancestors: CommentTreeNode<T>[] = [];
  let parentId = comment.parentId;

  while (parentId) {
    const parent = commentMap.get(parentId);

    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    parentId = parent.parentId;
  }

  return ancestors;
}
