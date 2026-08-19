import "server-only";

import {
  buildCommentTree,
  buildCommentTreeWithMap,
  getCommentAncestorChain,
  type CommentTreeNode,
} from "@/lib/comment-tree";
import { POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

type PoemarioCommentRecord = {
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  text: string;
  updatedAt: Date;
};

export type PoemarioCommentTree = CommentTreeNode<PoemarioCommentRecord>;

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
      customAuthorAvatarUrl: post.customAuthorAvatarUrl,
      customAuthorName: post.customAuthorName,
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
    customAuthorAvatarUrl: post.customAuthorAvatarUrl,
    customAuthorName: post.customAuthorName,
    id: post.id,
    thread: buildCommentTree(post.comments),
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

  const { commentMap } = buildCommentTreeWithMap(post.comments);
  const comment = commentMap.get(normalizedCommentId);

  if (!comment || comment.postId !== post.id) {
    return null;
  }

  return {
    ancestors: getCommentAncestorChain(comment, commentMap),
    comment,
    post: {
      commentCount: post._count.comments,
      content: post.content,
      createdAt: post.createdAt,
      customAuthorAvatarUrl: post.customAuthorAvatarUrl,
      customAuthorName: post.customAuthorName,
      id: post.id,
      updatedAt: post.updatedAt,
    },
  };
}
