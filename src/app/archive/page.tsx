import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import NumberedPagination from "@/app/_components/numbered-pagination";
import { ARCHIVE_ALBUM_KIND } from "@/lib/archive";
import {
  formatArchiveTimestamp,
  getArchivePostsPage,
} from "@/lib/archive-posts";
import { ARCHIVE_PATH, parsePageParam } from "@/lib/posts";

import ArchiveCarousel from "./archive-carousel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "archive",
  description: "archivo visual",
  openGraph: {
    title: "archive",
    description: "archivo visual",
    url: "https://haaaaaaammmm.com/archive",
    siteName: "yo",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "archive",
    description: "archivo visual",
  },
};

type ArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type ArchiveListPost = Awaited<
  ReturnType<typeof getArchivePostsPage>
>["posts"][number];

function getExcerpt(value: string, maxLength = 140) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

function ArchiveAlbumCard({ post }: { post: ArchiveListPost }) {
  const coverImage = post.coverImage ?? post.images[0] ?? null;
  const previewImages = post.images
    .filter((image) => image.id !== coverImage?.id)
    .slice(0, 3);
  const href = `${ARCHIVE_PATH}/album/${post.id}`;
  const excerpt = post.description ? getExcerpt(post.description) : "";
  const hasDescriptionLinks = hasLinkifiedText(excerpt);
  const meta = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <time
        className="text-sm leading-5 text-neutral-500"
        dateTime={post.takenAt.toISOString()}
      >
        {formatArchiveTimestamp(post.takenAt)}
      </time>
      <span className="text-sm text-neutral-500">album</span>
    </div>
  );
  const media = (
    <div className="mt-3 grid grid-cols-[1fr_5.5rem] gap-2 sm:grid-cols-[1fr_7rem]">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        {coverImage ? (
          <img
            alt={post.title ?? "album cover"}
            className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.01]"
            loading="lazy"
            src={coverImage.url}
          />
        ) : (
          <div className="aspect-[4/5]" />
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-1 text-xs text-neutral-200">
          {post.imageCount} foto{post.imageCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-rows-3 gap-2">
        {previewImages.length > 0
          ? previewImages.map((image, index) => (
              <div
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                key={image.id}
              >
                <img
                  alt={`${post.title ?? "album"} preview ${index + 1}`}
                  className="aspect-square h-full w-full object-cover"
                  loading="lazy"
                  src={image.url}
                />
              </div>
            ))
          : [0, 1, 2].map((index) => (
              <div
                className="rounded-xl border border-neutral-900 bg-neutral-950"
                key={index}
              />
            ))}
      </div>
    </div>
  );
  const details = (
    <div className="mt-3 space-y-1">
      <h2 className="text-lg font-semibold leading-6 text-white">
        {post.title ?? "album"}
      </h2>
      {excerpt ? (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
          <LinkifiedText text={excerpt} />
        </p>
      ) : null}
      <span className="inline-flex rounded-full px-0 py-1 text-sm text-[#ff003c] transition group-hover:text-[#ff4d75]">
        ver album
      </span>
    </div>
  );

  if (hasDescriptionLinks) {
    return (
      <div className="group">
        <Link className="block" href={href}>
          {meta}
          {media}
        </Link>
        <div className="mt-3 space-y-1">
          <Link className="block" href={href}>
            <h2 className="text-lg font-semibold leading-6 text-white">
              {post.title ?? "album"}
            </h2>
          </Link>
          {excerpt ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
              <LinkifiedText text={excerpt} />
            </p>
          ) : null}
          <Link
            className="inline-flex rounded-full px-0 py-1 text-sm text-[#ff003c] transition hover:text-[#ff4d75]"
            href={href}
          >
            ver album
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link className="group block" href={href}>
      {meta}
      {media}
      {details}
    </Link>
  );
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const { posts, totalPages } = await getArchivePostsPage(page);

  // Out-of-range page (e.g. posts were deleted): send to the last valid page so
  // the URL, content, and highlighted page number stay in sync.
  if (totalPages > 0 && page > totalPages) {
    redirect(`${ARCHIVE_PATH}?page=${totalPages}`);
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Inicio"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href="/"
              >
                {"<"}
              </Link>
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
                archive
              </h1>
            </div>
          </div>
        </header>

        <section aria-label="Archive">
          {posts.length === 0 ? (
            <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm leading-6 text-neutral-500">
              todavia no hay archivo
            </p>
          ) : (
            <ol>
              {posts.map((post) => (
                <li
                  className="border-b border-neutral-800 transition hover:bg-neutral-950"
                  key={post.id}
                >
                  <article className="px-4 py-4">
                    {post.kind === ARCHIVE_ALBUM_KIND ? (
                      <ArchiveAlbumCard post={post} />
                    ) : (
                      <>
                        <Link
                          aria-label={`Open archive post from ${formatArchiveTimestamp(
                            post.takenAt
                          )}`}
                          className="block"
                          href={`${ARCHIVE_PATH}/${post.id}`}
                        >
                          <time
                            className="text-sm leading-5 text-neutral-500"
                            dateTime={post.takenAt.toISOString()}
                          >
                            {formatArchiveTimestamp(post.takenAt)}
                          </time>
                        </Link>

                        <ArchiveCarousel
                          description={post.description}
                          href={`${ARCHIVE_PATH}/${post.id}`}
                          images={post.images.map((image) => ({
                            id: image.id,
                            url: image.url,
                          }))}
                        />

                        {post.description && hasLinkifiedText(post.description) ? (
                          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                            <LinkifiedText text={post.description} />
                          </p>
                        ) : post.description ? (
                          <Link
                            className="mt-3 block"
                            href={`${ARCHIVE_PATH}/${post.id}`}
                          >
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                              <LinkifiedText text={post.description} />
                            </p>
                          </Link>
                        ) : null}
                      </>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
          <NumberedPagination
            basePath={ARCHIVE_PATH}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
