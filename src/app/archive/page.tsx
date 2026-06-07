import type { Metadata } from "next";
import { redirect } from "next/navigation";

import NumberedPagination from "@/app/_components/numbered-pagination";
import {
  ARCHIVE_PATH,
  ARCHIVE_POSTS_PER_PAGE,
  parsePageParam,
} from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";

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

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const prisma = getPrisma();
  const [totalPosts, posts] = await Promise.all([
    prisma.archivePost.count(),
    prisma.archivePost.findMany({
      include: {
        images: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * ARCHIVE_POSTS_PER_PAGE,
      take: ARCHIVE_POSTS_PER_PAGE,
    }),
  ]);
  const totalPages = Math.ceil(totalPosts / ARCHIVE_POSTS_PER_PAGE);

  // Out-of-range page (e.g. posts were deleted): send to the last valid page so
  // the URL, content, and highlighted page number stay in sync.
  if (totalPages > 0 && page > totalPages) {
    redirect(`${ARCHIVE_PATH}?page=${totalPages}`);
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
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
                    <time
                      className="text-sm leading-5 text-neutral-500"
                      dateTime={post.takenAt.toISOString()}
                    >
                      {formatTimestamp(post.takenAt)}
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
