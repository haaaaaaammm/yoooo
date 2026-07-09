import "server-only";

import { ARCHIVO_ALBUM_THRESHOLD } from "@/lib/archivo";
import {
  ARCHIVO_ALBUM_PHOTOS_PER_PAGE,
  ARCHIVO_POSTS_PER_PAGE,
} from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

const archivoCompactPostInclude = {
  _count: {
    select: { images: true },
  },
  coverImage: true,
  images: {
    orderBy: { order: "asc" as const },
    take: ARCHIVO_ALBUM_THRESHOLD + 1,
  },
};

const archivoFullPostInclude = {
  _count: {
    select: { images: true },
  },
  coverImage: true,
  images: {
    orderBy: { order: "asc" as const },
  },
};

export function formatArchivoTimestamp(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export async function getArchivoPostsPage(page: number) {
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.archivePost.count(),
    prisma.archivePost.findMany({
      include: archivoCompactPostInclude,
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * ARCHIVO_POSTS_PER_PAGE,
      take: ARCHIVO_POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts: posts.map((post) => ({
      ...post,
      coverImage: post.coverImage ?? post.images[0] ?? null,
      imageCount: post._count.images,
    })),
    totalPages: Math.ceil(totalPosts / ARCHIVO_POSTS_PER_PAGE),
    totalPosts,
  };
}

export async function getAdminArchivoPostsPage(page: number) {
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.archivePost.count(),
    prisma.archivePost.findMany({
      include: archivoFullPostInclude,
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * ARCHIVO_POSTS_PER_PAGE,
      take: ARCHIVO_POSTS_PER_PAGE,
    }),
  ]);

  return {
    posts: posts.map((post) => ({
      ...post,
      coverImage: post.coverImage ?? post.images[0] ?? null,
      imageCount: post._count.images,
    })),
    totalPages: Math.ceil(totalPosts / ARCHIVO_POSTS_PER_PAGE),
    totalPosts,
  };
}

export async function getArchivoPostById(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  return getPrisma().archivePost.findUnique({
    include: archivoFullPostInclude,
    where: { id: postId },
  });
}

// Lightweight album fetch for generateMetadata: post fields + cover + the first
// image as a cover fallback, without loading every album photo.
export async function getArchivoAlbumMeta(id: string) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  return getPrisma().archivePost.findUnique({
    include: {
      coverImage: true,
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    where: { id: postId },
  });
}

// One page of an album's photos. Fetches post metadata + total image count + the
// current page slice only (never all photos), ordered consistently by `order`.
// `page` is clamped to [1, totalPages]; the returned `page` is the clamped value
// so callers can redirect an out-of-range URL to a valid one.
export async function getArchivoAlbumPage(id: string, page: number) {
  const postId = id.trim();

  if (!postId) {
    return null;
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    include: {
      _count: { select: { images: true } },
      coverImage: true,
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    where: { id: postId },
  });

  if (!post) {
    return null;
  }

  const totalImages = post._count.images;
  const totalPages = Math.max(1, Math.ceil(totalImages / ARCHIVO_ALBUM_PHOTOS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const images = await prisma.archiveImage.findMany({
    orderBy: { order: "asc" },
    skip: (safePage - 1) * ARCHIVO_ALBUM_PHOTOS_PER_PAGE,
    take: ARCHIVO_ALBUM_PHOTOS_PER_PAGE,
    where: { postId },
  });

  return {
    coverImage: post.coverImage ?? post.images[0] ?? null,
    images,
    page: safePage,
    post,
    totalImages,
    totalPages,
  };
}
