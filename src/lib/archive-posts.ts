import "server-only";

import { ARCHIVE_ALBUM_THRESHOLD } from "@/lib/archive";
import { ARCHIVE_POSTS_PER_PAGE } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

const archiveCompactPostInclude = {
  _count: {
    select: { images: true },
  },
  coverImage: true,
  images: {
    orderBy: { order: "asc" as const },
    take: ARCHIVE_ALBUM_THRESHOLD + 1,
  },
};

const archiveFullPostInclude = {
  _count: {
    select: { images: true },
  },
  coverImage: true,
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
      include: archiveCompactPostInclude,
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * ARCHIVE_POSTS_PER_PAGE,
      take: ARCHIVE_POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts: posts.map((post) => ({
      ...post,
      coverImage: post.coverImage ?? post.images[0] ?? null,
      imageCount: post._count.images,
    })),
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
    include: archiveFullPostInclude,
    where: { id: postId },
  });
}
