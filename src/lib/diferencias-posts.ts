import "server-only";

import {
  buildCommentTree,
  buildCommentTreeWithMap,
  getCommentAncestorChain,
  type CommentTreeNode,
} from "@/lib/comment-tree";
import { POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

type DiferenciasCommentRecord = {
  authorAvatarUrl: string | null;
  authorId: string;
  authorName: string;
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  text: string;
  updatedAt: Date;
};

export type DiferenciasCommentTree =
  CommentTreeNode<DiferenciasCommentRecord>;

function mapComment(comment: {
  author: { avatarUrl: string | null; displayName: string };
  authorId: string;
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  text: string;
  updatedAt: Date;
}): DiferenciasCommentRecord {
  return {
    authorAvatarUrl: comment.author.avatarUrl,
    authorId: comment.authorId,
    authorName: comment.author.displayName,
    createdAt: comment.createdAt,
    id: comment.id,
    parentId: comment.parentId,
    postId: comment.postId,
    text: comment.text,
    updatedAt: comment.updatedAt,
  };
}

function mapPost(post: {
  _count: { comments: number };
  author: { avatarUrl: string | null; displayName: string; id: string };
  authorId: string;
  content: string;
  createdAt: Date;
  id: string;
  updatedAt: Date;
}) {
  return {
    authorId: post.authorId,
    commentCount: post._count.comments,
    content: post.content,
    createdAt: post.createdAt,
    customAuthorAvatarUrl: post.author.avatarUrl,
    customAuthorName: post.author.displayName,
    id: post.id,
    updatedAt: post.updatedAt,
  };
}

const postListInclude = {
  _count: { select: { comments: true } },
  author: {
    select: { avatarUrl: true, displayName: true, id: true },
  },
} as const;

export async function getDiferenciasPostsPage(page: number) {
  const prisma = getPrisma();
  const totalPosts = await prisma.diferenciasPost.count();
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  const queryPage = Number.isFinite(page)
    ? Math.min(Math.max(page, 1), Math.max(totalPages, 1))
    : 1;
  const posts =
    totalPosts === 0
      ? []
      : await prisma.diferenciasPost.findMany({
          include: postListInclude,
          orderBy: { createdAt: "desc" },
          skip: (queryPage - 1) * POSTS_PER_PAGE,
          take: POSTS_PER_PAGE,
        });

  return {
    posts: posts.map(mapPost),
    totalPages,
    totalPosts,
  };
}

export async function getDiferenciasPostsByAuthorPage(
  authorId: string,
  page: number
) {
  const prisma = getPrisma();
  const where = { authorId };
  const totalPosts = await prisma.diferenciasPost.count({ where });
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  const queryPage = Number.isFinite(page)
    ? Math.min(Math.max(page, 1), Math.max(totalPages, 1))
    : 1;
  const posts =
    totalPosts === 0
      ? []
      : await prisma.diferenciasPost.findMany({
          include: postListInclude,
          orderBy: { createdAt: "desc" },
          skip: (queryPage - 1) * POSTS_PER_PAGE,
          take: POSTS_PER_PAGE,
          where,
        });

  return {
    posts: posts.map(mapPost),
    totalPages,
    totalPosts,
  };
}

export async function getDiferenciasPostById(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  return getPrisma().diferenciasPost.findUnique({
    select: { content: true, id: true },
    where: { id: postId },
  });
}

export async function getDiferenciasPostWithThread(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  const post = await getPrisma().diferenciasPost.findUnique({
    include: {
      ...postListInclude,
      comments: {
        include: {
          author: { select: { avatarUrl: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    where: { id: postId },
  });

  if (!post) {
    return null;
  }

  return {
    ...mapPost(post),
    thread: buildCommentTree(post.comments.map(mapComment)),
  };
}

export async function getDiferenciasCommentPageData(
  postId: string,
  commentId: string
) {
  const normalizedPostId = postId.trim();
  const normalizedCommentId = commentId.trim();

  if (!normalizedPostId || !normalizedCommentId) {
    return null;
  }

  const post = await getPrisma().diferenciasPost.findUnique({
    include: {
      ...postListInclude,
      comments: {
        include: {
          author: { select: { avatarUrl: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    where: { id: normalizedPostId },
  });

  if (!post) {
    return null;
  }

  const { commentMap } = buildCommentTreeWithMap(
    post.comments.map(mapComment)
  );
  const comment = commentMap.get(normalizedCommentId);

  if (!comment || comment.postId !== post.id) {
    return null;
  }

  return {
    ancestors: getCommentAncestorChain(comment, commentMap),
    comment,
    post: mapPost(post),
  };
}

export async function getDiferenciasUsersForAdmin() {
  const users = await getPrisma().diferenciasUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      _count: { select: { posts: true } },
      avatarUrl: true,
      createdAt: true,
      displayName: true,
      id: true,
      isActive: true,
      lastLoginAt: true,
      posts: {
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
        take: 1,
      },
      username: true,
    },
  });

  return users.map((user) => ({
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    displayName: user.displayName,
    id: user.id,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    lastPostAt: user.posts[0]?.createdAt ?? null,
    postCount: user._count.posts,
    username: user.username,
  }));
}
