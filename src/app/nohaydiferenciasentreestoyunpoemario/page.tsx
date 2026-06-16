import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminPostLink from "@/app/_components/admin-post-link";
import NumberedPagination from "@/app/_components/numbered-pagination";
import FeedPostCard from "@/app/_components/feed-post-card";
import { getPoemarioPostsPage } from "@/lib/poemario-posts";
import { PUBLIC_FEED_PATH, parsePageParam } from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "no hay diferencias entre esto y un poemario",
  description: "",
  openGraph: {
    title: "no hay diferencias entre esto y un poemario",
    description: "",
    url: "https://haaaaaaammmm.com/nohaydiferenciasentreestoyunpoemario",
    siteName: "yo",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "no hay diferencias entre esto y un poemario",
    description: "",
  },
};

type PublicFeedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatPostCount(count: number) {
  const formattedCount = new Intl.NumberFormat("es-MX").format(count);

  return `${formattedCount} ${count === 1 ? "post" : "posts"}`;
}

export default async function Page({ searchParams }: PublicFeedPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const [{ posts, totalPages, totalPosts }, profileImageSettings] =
    await Promise.all([
      getPoemarioPostsPage(page),
      getProfileImageSettings(),
    ]);
  const profileImageUrl = profileImageSettings.profileImageUrl;
  const postCountLabel = formatPostCount(totalPosts);

  // Out-of-range page (e.g. posts were deleted): send to the last valid page so
  // the URL, content, and highlighted page number stay in sync.
  if (totalPages > 0 && page > totalPages) {
    redirect(`${PUBLIC_FEED_PATH}?page=${totalPages}`);
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
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold leading-6 tracking-wide text-white">
                  yoooooooooooo
                </h1>
                <p className="truncate mt-2 text-[13px] leading-4 text-neutral-500">
                  {postCountLabel}
                </p>
              </div>
            </div>
            <AdminPostLink />
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
                  href={`${PUBLIC_FEED_PATH}/${post.id}`}
                  key={post.id}
                  post={post}
                  profileImageUrl={profileImageUrl}
                />
              ))}
            </ol>
          )}
          <NumberedPagination
            basePath={PUBLIC_FEED_PATH}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
