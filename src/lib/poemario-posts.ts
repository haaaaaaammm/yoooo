import "server-only";

import { POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

export type PoemarioCommentTree = {
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  replies: PoemarioCommentTree[];
  text: string;
  updatedAt: Date;
};

type PoemarioCommentRecord = Omit<PoemarioCommentTree, "replies">;

function buildPoemarioCommentTreeWithMap(comments: PoemarioCommentRecord[]) {
  const commentMap = new Map<string, PoemarioCommentTree>();
  const roots: PoemarioCommentTree[] = [];

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

function buildPoemarioCommentTree(comments: PoemarioCommentRecord[]) {
  return buildPoemarioCommentTreeWithMap(comments).roots;
}

function getPoemarioCommentAncestorChain(
  comment: PoemarioCommentTree,
  commentMap: Map<string, PoemarioCommentTree>
) {
  const ancestors: PoemarioCommentTree[] = [];
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

export async function getPoemarioPostsPage(page: number) {
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.post.count(),
    prisma.post.findMany({
      include: {
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts: posts.map((post) => ({
      commentCount: post._count.comments,
      content: post.content,
      createdAt: post.createdAt,
      id: post.id,
      updatedAt: post.updatedAt,
    })),
    totalPages: Math.ceil(totalPosts / POSTS_PER_PAGE),
    totalPosts,
  };
}

export async function getPoemarioPostById(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  return getPrisma().post.findUnique({
    where: { id: postId },
  });
}

export async function getPoemarioPostWithThread(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  const post = await getPrisma().post.findUnique({
    include: {
      _count: {
        select: { comments: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
      },
    },
    where: { id: postId },
  });

  if (!post) {
    return null;
  }

  return {
    commentCount: post._count.comments,
    content: post.content,
    createdAt: post.createdAt,
    id: post.id,
    thread: buildPoemarioCommentTree(post.comments),
    updatedAt: post.updatedAt,
  };
}

export async function getPoemarioCommentPageData(
  postId: string,
  commentId: string
) {
  const normalizedPostId = postId.trim();
  const normalizedCommentId = commentId.trim();

  if (!normalizedPostId || !normalizedCommentId) {
    return null;
  }

  const post = await getPrisma().post.findUnique({
    include: {
      _count: {
        select: { comments: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
      },
    },
    where: { id: normalizedPostId },
  });

  if (!post) {
    return null;
  }

  const { commentMap } = buildPoemarioCommentTreeWithMap(post.comments);
  const comment = commentMap.get(normalizedCommentId);

  if (!comment || comment.postId !== post.id) {
    return null;
  }

  return {
    ancestors: getPoemarioCommentAncestorChain(comment, commentMap),
    comment,
    post: {
      commentCount: post._count.comments,
      content: post.content,
      createdAt: post.createdAt,
      id: post.id,
      updatedAt: post.updatedAt,
    },
  };
}
