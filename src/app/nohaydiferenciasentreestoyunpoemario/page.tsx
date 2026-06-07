import type { Metadata } from "next";

import FeedPagination from "@/app/_components/feed-pagination";
import FeedPostCard from "@/app/_components/feed-post-card";
import {
  POSTS_PER_PAGE,
  PUBLIC_FEED_PATH,
  parsePageParam,
} from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";
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

export default async function Page({ searchParams }: PublicFeedPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const prisma = getPrisma();
  const [totalPosts, posts, profileImageSettings] = await Promise.all([
    prisma.post.count(),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
    }),
    getProfileImageSettings(),
  ]);
  const hasNextPage = page * POSTS_PER_PAGE < totalPosts;
  const profileImageUrl = profileImageSettings.profileImageUrl;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <h1 className="truncate text-xl font-semibold tracking-wide text-white">
            yoooooooooooo
          </h1>
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
                  key={post.id}
                  post={post}
                  profileImageUrl={profileImageUrl}
                />
              ))}
            </ol>
          )}
          <FeedPagination
            basePath={PUBLIC_FEED_PATH}
            hasNextPage={hasNextPage}
            page={page}
          />
        </section>
      </div>
    </main>
  );
}
