import "server-only";

import { ARCHIVE_POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

const archivePostInclude = {
  images: {
    orderBy: { order: "asc" as const },
  },
};

export function formatArchiveTimestamp(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export async function getArchivePostsPage(page: number) {
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.archivePost.count(),
    prisma.archivePost.findMany({
      include: archivePostInclude,
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * ARCHIVE_POSTS_PER_PAGE,
      take: ARCHIVE_POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts,
    totalPages: Math.ceil(totalPosts / ARCHIVE_POSTS_PER_PAGE),
    totalPosts,
  };
}

export async function getArchivePostById(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  return getPrisma().archivePost.findUnique({
    include: archivePostInclude,
    where: { id: postId },
  });
}
