import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ARCHIVE_ALBUM_KIND } from "@/lib/archive";
import {
  formatArchiveTimestamp,
  getArchivePostById,
} from "@/lib/archive-posts";
import { ARCHIVE_PATH } from "@/lib/posts";

import ArchiveCarousel from "../archive-carousel";
import CopyLinkButton from "./copy-link-button";

export const dynamic = "force-dynamic";

type ArchivePostPageProps = {
  params: Promise<{ id: string }>;
};

function getExcerpt(value: string, maxLength = 90) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: ArchivePostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getArchivePostById(id);

  if (!post) {
    return {
      title: "archive",
      description: "archivo visual",
    };
  }

  const excerpt = getExcerpt(post.description);
  const date = formatArchiveTimestamp(post.takenAt);
  const title = excerpt ? `${excerpt} | archive` : `${date} | archive`;
  const description = excerpt || date;
  const firstImage = post.images[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://haaaaaaammmm.com${ARCHIVE_PATH}/${post.id}`,
      siteName: "yo",
      locale: "es_ES",
      type: "article",
      images: firstImage ? [{ url: firstImage.url }] : undefined,
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      images: firstImage ? [firstImage.url] : undefined,
    },
  };
}

export default async function ArchivePostPage({
  params,
}: ArchivePostPageProps) {
  const { id } = await params;
  const post = await getArchivePostById(id);

  if (!post) {
    notFound();
  }

  if (post.kind === ARCHIVE_ALBUM_KIND) {
    redirect(`${ARCHIVE_PATH}/album/${post.id}`);
  }

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
            <CopyLinkButton />
          </div>
        </header>

        <article className="border-b border-neutral-800 px-4 py-4">
          <time
            className="text-sm leading-5 text-neutral-500"
            dateTime={post.takenAt.toISOString()}
          >
            {formatArchiveTimestamp(post.takenAt)}
          </time>

          <ArchiveCarousel
            description={post.description}
            images={post.images.map((image) => ({
              id: image.id,
              url: image.url,
            }))}
          />

          {post.description ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
              {post.description}
            </p>
          ) : null}
        </article>
      </div>
    </main>
  );
}
