import "server-only";

import { createHash } from "crypto";
import { after } from "next/server";

import { fetchExternalLinkPreview } from "./link-preview-fetch";
import { getPrisma } from "./prisma";
import { isOwnSiteUrl, SITE_ORIGIN } from "./site-url";
import { getFirstPreviewUrl } from "./text-links";

const SUCCESS_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const FAILURE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_BACKGROUND_PREVIEWS = 3;
const APPLE_MUSIC_CACHE_STATUS_VERSION = "apple-v3";

function isAppleMusicUrl(value: string) {
  try {
    return new URL(value).hostname.toLowerCase() === "music.apple.com";
  } catch {
    return false;
  }
}

function isReadyStatus(status: string) {
  return status === "ready" || status.startsWith("ready:");
}

function getCacheMaxAge(status: string) {
  return isReadyStatus(status) ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
}

function getResolvedStatus(url: string, hasMetadata: boolean) {
  if (!isAppleMusicUrl(url)) {
    return hasMetadata ? "ready" : "failed";
  }

  return `${hasMetadata ? "ready" : "failed"}:${APPLE_MUSIC_CACHE_STATUS_VERSION}`;
}

function needsCacheRefresh(
  url: string,
  cached: { fetchedAt: Date; status: string } | undefined,
  now: number
) {
  if (!cached) {
    return true;
  }

  if (
    isAppleMusicUrl(url) &&
    !cached.status.endsWith(`:${APPLE_MUSIC_CACHE_STATUS_VERSION}`)
  ) {
    return true;
  }

  return now - cached.fetchedAt.getTime() > getCacheMaxAge(cached.status);
}

export type LinkPreviewData = {
  authorAvatarUrl?: string | null;
  authorName?: string | null;
  commentCount?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  kind: "external" | "internal-link" | "internal-repost" | "unavailable";
  publishedAt?: string | null;
  siteName?: string | null;
  title?: string | null;
  url: string;
};

type PreviewTarget =
  | { kind: "external"; url: string }
  | { id: string; kind: "archivo"; url: string }
  | { id: string; kind: "otrogato"; url: string }
  | { id: string; kind: "poemario"; url: string }
  | { kind: "internal-link"; private: boolean; url: string };

function getUrlHash(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

function getInternalTarget(url: URL): PreviewTarget {
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const [root, second, third] = pathSegments;

  if (root === "otrogato" && second && !third) {
    let id = second;

    try {
      id = decodeURIComponent(second);
    } catch {
      // A malformed path segment cannot match a database ID.
    }

    return {
      id,
      kind: "otrogato",
      url: `${SITE_ORIGIN}/otrogato/${encodeURIComponent(id)}`,
    };
  }

  if (root === "nohaydiferenciasentreestoyunpoemario" && second) {
    return { id: second, kind: "poemario", url: url.toString() };
  }

  if (root === "archivo" && second === "album" && third) {
    return { id: third, kind: "archivo", url: url.toString() };
  }

  if (root === "archivo" && second) {
    return { id: second, kind: "archivo", url: url.toString() };
  }

  if (root === "archive" && second === "album" && third) {
    return { id: third, kind: "archivo", url: url.toString() };
  }

  if (root === "archive" && second) {
    return { id: second, kind: "archivo", url: url.toString() };
  }

  return {
    kind: "internal-link",
    private: root === "otrogato" || root === "diferencias" || root === "yoooo",
    url: url.toString(),
  };
}

export function classifyPreviewUrl(value: string): PreviewTarget {
  const url = new URL(value, SITE_ORIGIN);

  return isOwnSiteUrl(url)
    ? getInternalTarget(url)
    : { kind: "external", url: url.toString() };
}

async function resolveAndCacheExternalPreview(
  url: string,
  prisma = getPrisma()
) {
  const urlHash = getUrlHash(url);

  try {
    const metadata = await fetchExternalLinkPreview(url);
    const hasMetadata = Boolean(
      metadata.title ||
        metadata.description ||
        metadata.siteName ||
        metadata.imageUrl
    );
    const status = getResolvedStatus(url, hasMetadata);

    await prisma.linkPreview.upsert({
      create: {
        description: metadata.description,
        fetchedAt: new Date(),
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        status,
        title: metadata.title,
        url,
        urlHash,
      },
      update: {
        description: metadata.description,
        fetchedAt: new Date(),
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        status,
        title: metadata.title,
        url,
      },
      where: { urlHash },
    });
  } catch {
    const status = getResolvedStatus(url, false);

    await prisma.linkPreview.upsert({
      create: { fetchedAt: new Date(), status, url, urlHash },
      update: {
        description: null,
        fetchedAt: new Date(),
        imageUrl: null,
        siteName: null,
        status,
        title: null,
        url,
      },
      where: { urlHash },
    });
  }
}

async function refreshExternalPreviewsIfNeeded(urls: string[]) {
  const prisma = getPrisma();
  const uniqueUrls = [...new Set(urls)].slice(0, MAX_BACKGROUND_PREVIEWS);
  const hashes = uniqueUrls.map(getUrlHash);
  const cachedPreviews = await prisma.linkPreview.findMany({
    select: { fetchedAt: true, status: true, urlHash: true },
    where: { urlHash: { in: hashes } },
  });
  const cacheByHash = new Map(
    cachedPreviews.map((preview) => [preview.urlHash, preview])
  );
  const now = Date.now();
  const urlsToFetch = uniqueUrls.filter((url) => {
    const cached = cacheByHash.get(getUrlHash(url));

    return needsCacheRefresh(url, cached, now);
  });

  await Promise.allSettled(
    urlsToFetch.map((url) => resolveAndCacheExternalPreview(url, prisma))
  );
}

function scheduleExternalPreviews(urls: string[]) {
  const uniqueUrls = [...new Set(urls)].slice(0, MAX_BACKGROUND_PREVIEWS);

  if (uniqueUrls.length === 0) {
    return;
  }

  try {
    after(async () => {
      await refreshExternalPreviewsIfNeeded(uniqueUrls);
    });
  } catch {
    // Preview enrichment is optional and must never break a post response.
  }
}

export function scheduleLinkPreviewResolution(content: string) {
  const url = getFirstPreviewUrl(content);

  if (!url || classifyPreviewUrl(url).kind !== "external") {
    return;
  }

  scheduleExternalPreviews([url]);
}

export async function addLinkPreviewsToPosts<
  T extends { content: string }
>(posts: T[]): Promise<Array<T & { preview: LinkPreviewData | null }>> {
  const prisma = getPrisma();
  const targets = posts.map((post) => {
    const url = getFirstPreviewUrl(post.content);
    return url ? classifyPreviewUrl(url) : null;
  });
  const externalTargets = targets.filter(
    (target): target is Extract<PreviewTarget, { kind: "external" }> =>
      target?.kind === "external"
  );
  const poemarioIds = [
    ...new Set(
      targets
        .filter(
          (target): target is Extract<PreviewTarget, { kind: "poemario" }> =>
            target?.kind === "poemario"
        )
        .map(({ id }) => id)
    ),
  ];
  const archivoIds = [
    ...new Set(
      targets
        .filter(
          (target): target is Extract<PreviewTarget, { kind: "archivo" }> =>
            target?.kind === "archivo"
        )
        .map(({ id }) => id)
    ),
  ];
  const externalHashes = externalTargets.map(({ url }) => getUrlHash(url));
  const [cachedPreviews, poemarioPosts, archivoPosts, settings] =
    await Promise.all([
      externalHashes.length
        ? prisma.linkPreview.findMany({
            where: { urlHash: { in: externalHashes } },
          })
        : [],
      poemarioIds.length
        ? prisma.post.findMany({
            select: {
              content: true,
              createdAt: true,
              customAuthorAvatarUrl: true,
              customAuthorName: true,
              id: true,
            },
            where: { id: { in: poemarioIds } },
          })
        : [],
      archivoIds.length
        ? prisma.archivePost.findMany({
            include: {
              coverImage: true,
              images: { orderBy: { order: "asc" }, take: 1 },
            },
            where: { id: { in: archivoIds } },
          })
        : [],
      poemarioIds.length
        ? prisma.siteSettings.findUnique({ where: { id: "default" } })
        : null,
    ]);
  const cacheByHash = new Map(
    cachedPreviews.map((preview) => [preview.urlHash, preview])
  );
  const poemarioById = new Map(poemarioPosts.map((post) => [post.id, post]));
  const archivoById = new Map(archivoPosts.map((post) => [post.id, post]));
  const now = Date.now();
  const urlsToRefresh: string[] = [];

  const enrichedPosts = posts.map((post, index) => {
    const target = targets[index];
    let preview: LinkPreviewData | null = null;

    if (!target) {
      return { ...post, preview };
    }

    if (target.kind === "external") {
      const cached = cacheByHash.get(getUrlHash(target.url));

      if (needsCacheRefresh(target.url, cached, now)) {
        urlsToRefresh.push(target.url);
      }

      if (cached && isReadyStatus(cached.status)) {
        preview = {
          description: cached.description,
          imageUrl: cached.imageUrl,
          kind: "external",
          siteName: cached.siteName,
          title: cached.title,
          url: target.url,
        };
      }
    } else if (target.kind === "poemario") {
      const referencedPost = poemarioById.get(target.id);

      preview = referencedPost
        ? {
            authorAvatarUrl:
              referencedPost.customAuthorAvatarUrl ??
              settings?.profileImageUrl ??
              null,
            authorName: referencedPost.customAuthorName ?? "humberto",
            description: referencedPost.content,
            kind: "internal-repost",
            publishedAt: referencedPost.createdAt.toISOString(),
            siteName: "yo",
            url: target.url,
          }
        : { kind: "unavailable", url: target.url };
    } else if (target.kind === "archivo") {
      const referencedPost = archivoById.get(target.id);
      const image =
        referencedPost?.coverImage ?? referencedPost?.images[0] ?? null;

      preview = referencedPost
        ? {
            authorName: "humberto",
            description: referencedPost.description,
            imageUrl: image?.url ?? null,
            kind: "internal-repost",
            publishedAt: referencedPost.takenAt.toISOString(),
            siteName: "archivo",
            title: referencedPost.title,
            url: target.url,
          }
        : { kind: "unavailable", url: target.url };
    } else if (target.kind === "otrogato") {
      preview = {
        kind: "internal-link",
        siteName: new URL(SITE_ORIGIN).hostname,
        title: "private link",
        url: target.url,
      };
    } else if (target.kind === "internal-link") {
      preview = {
        kind: "internal-link",
        siteName: new URL(SITE_ORIGIN).hostname,
        title: target.private ? "private link" : "yo",
        url: target.url,
      };
    }

    return { ...post, preview };
  });

  scheduleExternalPreviews(urlsToRefresh);

  return enrichedPosts;
}
