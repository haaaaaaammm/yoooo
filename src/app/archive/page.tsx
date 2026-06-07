import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import NumberedPagination from "@/app/_components/numbered-pagination";
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
          <h1 className="truncate text-xl font-semibold tracking-wide text-white">
            archive
          </h1>
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

                    {post.description ? (
                      <Link
                        className="mt-3 block"
                        href={`${ARCHIVE_PATH}/${post.id}`}
                      >
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                          {post.description}
                        </p>
                      </Link>
                    ) : null}
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
