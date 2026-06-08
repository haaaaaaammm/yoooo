import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AdminPostLink from "@/app/_components/admin-post-link";
import LinkifiedText from "@/app/_components/linkified-text";
import NumberedPagination from "@/app/_components/numbered-pagination";
import { ARCHIVE_ALBUM_KIND } from "@/lib/archive";
import {
  formatArchiveTimestamp,
  getArchiveAlbumMeta,
  getArchiveAlbumPage,
} from "@/lib/archive-posts";
import { ADMIN_PATH, ARCHIVE_PATH, parsePageParam } from "@/lib/posts";

import CopyLinkButton from "../../[id]/copy-link-button";
import AlbumPhotoGrid from "./album-photo-grid";

export const dynamic = "force-dynamic";

type ArchiveAlbumPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getExcerpt(value: string, maxLength = 160) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: ArchiveAlbumPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getArchiveAlbumMeta(id);

  if (!post || post.kind !== ARCHIVE_ALBUM_KIND) {
    return {
      description: "archivo visual",
      title: "archive",
    };
  }

  const title = post.title ? `${post.title} | archive` : "album | archive";
  const description =
    getExcerpt(post.description) || formatArchiveTimestamp(post.takenAt);
  const coverImage = post.coverImage ?? post.images[0];

  return {
    description,
    openGraph: {
      description,
      images: coverImage ? [{ url: coverImage.url }] : undefined,
      locale: "es_ES",
      siteName: "yo",
      title,
      type: "article",
      url: `https://haaaaaaammmm.com${ARCHIVE_PATH}/album/${post.id}`,
    },
    title,
    twitter: {
      card: coverImage ? "summary_large_image" : "summary",
      description,
      images: coverImage ? [coverImage.url] : undefined,
      title,
    },
  };
}

export default async function ArchiveAlbumPage({
  params,
  searchParams,
}: ArchiveAlbumPageProps) {
  const { id } = await params;
  const requestedParams = (await searchParams) ?? {};
  const requestedPage = parsePageParam(requestedParams.page);
  const album = await getArchiveAlbumPage(id, requestedPage);

  if (!album) {
    notFound();
  }

  if (album.post.kind !== ARCHIVE_ALBUM_KIND) {
    redirect(`${ARCHIVE_PATH}/${album.post.id}`);
  }

  // Out-of-range page (e.g. photos were removed): send to the last valid page so
  // the URL and rendered photos stay in sync.
  if (requestedPage > album.totalPages) {
    redirect(`${ARCHIVE_PATH}/album/${album.post.id}?page=${album.totalPages}`);
  }

  const { coverImage, images, page, post, totalImages, totalPages } = album;

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to archive"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={ARCHIVE_PATH}
              >
                &lt;
              </Link>
              <Link
                className="min-w-0 truncate text-xl font-semibold tracking-wide text-white"
                href={ARCHIVE_PATH}
              >
                archive
              </Link>
            </div>
            <div className="flex flex-none items-center gap-2">
              <CopyLinkButton />
              <AdminPostLink href={`${ADMIN_PATH}?app=archive`} />
            </div>
          </div>
        </header>

        <article className="border-b border-neutral-800 px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <time
              className="text-sm leading-5 text-neutral-500"
              dateTime={post.takenAt.toISOString()}
            >
              {formatArchiveTimestamp(post.takenAt)}
            </time>
            <span className="text-sm text-neutral-500">album</span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold leading-8 text-white">
            {post.title ?? "album"}
          </h1>

          {post.description ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
              <LinkifiedText text={post.description} />
            </p>
          ) : null}

          <p className="mt-3 text-sm text-neutral-500">
            {totalImages} foto{totalImages === 1 ? "" : "s"}
          </p>

          {coverImage ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
              <img
                alt={post.title ?? "album cover"}
                className="aspect-[4/5] w-full object-cover"
                loading="eager"
                src={coverImage.url}
              />
            </div>
          ) : null}

          <AlbumPhotoGrid
            images={images.map((image) => ({ id: image.id, url: image.url }))}
            title={post.title ?? "album"}
          />

          <NumberedPagination
            basePath={`${ARCHIVE_PATH}/album/${post.id}`}
            page={page}
            totalPages={totalPages}
          />
        </article>
      </div>
    </main>
  );
}
