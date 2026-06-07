import "server-only";

import { POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

export async function getPoemarioPostsPage(page: number) {
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.post.count(),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts,
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
