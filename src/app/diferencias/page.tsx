import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import FeedPostCard from "@/app/_components/feed-post-card";
import NumberedPagination from "@/app/_components/numbered-pagination";
import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import { getDiferenciasPostsPage } from "@/lib/diferencias-posts";
import {
  DIFERENCIAS_PATH,
  OTROGATO_PATH,
  parsePageParam,
} from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "",
  openGraph: {
    description: "",
    locale: "es_ES",
    siteName: "yo",
    title: "diferencias",
    type: "website",
    url: "https://haaaaaaammmm.com/diferencias",
  },
  title: "diferencias",
  twitter: {
    card: "summary",
    description: "",
    title: "diferencias",
  },
};

type DiferenciasFeedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiferenciasFeedPage({
  searchParams,
}: DiferenciasFeedPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const [{ posts, totalPages }, sessionUser] = await Promise.all([
    getDiferenciasPostsPage(page),
    getDiferenciasSessionUser(),
  ]);

  if (totalPages > 0 && page > totalPages) {
    redirect(`${DIFERENCIAS_PATH}?page=${totalPages}`);
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Inicio"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href="/"
              >
                {"<"}
              </Link>
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
                diferencias
              </h1>
            </div>
            {sessionUser ? (
              <Link
                className="flex flex-none items-center rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={OTROGATO_PATH}
              >
                Post
              </Link>
            ) : null}
          </div>
        </header>

        <section aria-label="Posts">
          {posts.length === 0 ? (
            <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm leading-6 text-neutral-500">
              todavia no hay posts
            </p>
          ) : (
            <ol>
              {posts.map((post) => (
                <FeedPostCard
                  href={`${DIFERENCIAS_PATH}/${post.id}`}
                  key={post.id}
                  post={post}
                />
              ))}
            </ol>
          )}
          <NumberedPagination
            basePath={DIFERENCIAS_PATH}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
