import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminPostLink from "@/app/_components/admin-post-link";
import FeedPostCard from "@/app/_components/feed-post-card";
import PoemarioCommentThread from "@/app/_components/poemario-comment-thread";
import {
  getPoemarioPostById,
  getPoemarioPostWithThread,
} from "@/lib/poemario-posts";
import { PUBLIC_FEED_PATH } from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

import CopyLinkButton from "./copy-link-button";

export const dynamic = "force-dynamic";

const FALLBACK_TITLE = "no hay diferencias entre esto y un poemario";

type PoemarioPostPageProps = {
  params: Promise<{ id: string }>;
};

function getExcerpt(value: string, maxLength: number) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: PoemarioPostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPoemarioPostById(id);

  if (!post) {
    return {
      title: FALLBACK_TITLE,
      description: "",
    };
  }

  const titleExcerpt = getExcerpt(post.content, 80);
  const description = getExcerpt(post.content, 160) || FALLBACK_TITLE;
  const title = titleExcerpt ? `:pp` : FALLBACK_TITLE;
  const url = `https://haaaaaaammmm.com${PUBLIC_FEED_PATH}/${post.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "yo",
      locale: "es_ES",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PoemarioPostPage({
  params,
}: PoemarioPostPageProps) {
  const { id } = await params;
  const [post, profileImageSettings] = await Promise.all([
    getPoemarioPostWithThread(id),
    getProfileImageSettings(),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to poemario"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={PUBLIC_FEED_PATH}
              >
                &lt;
              </Link>
              <Link
                className="min-w-0 truncate text-xl font-semibold tracking-wide text-white"
                href={PUBLIC_FEED_PATH}
              >
                yoooooooooooo
              </Link>
            </div>
            <div className="flex flex-none items-center gap-2">
              <CopyLinkButton />
              <AdminPostLink />
            </div>
          </div>
        </header>

        <section aria-label="Post">
          <ol>
            <FeedPostCard
              post={{
                commentCount: post.commentCount,
                content: post.content,
                createdAt: post.createdAt,
                customAuthorAvatarUrl: post.customAuthorAvatarUrl,
                customAuthorName: post.customAuthorName,
                id: post.id,
              }}
              profileImageUrl={profileImageSettings.profileImageUrl}
            />
          </ol>
        </section>

        <PoemarioCommentThread
          comments={post.thread}
          profileImageUrl={profileImageSettings.profileImageUrl}
        />
      </div>
    </main>
  );
}
