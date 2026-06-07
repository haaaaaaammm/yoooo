import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminPostLink from "@/app/_components/admin-post-link";
import FeedPostCard from "@/app/_components/feed-post-card";
import {
  PoemarioCommentBody,
  PoemarioCommentList,
} from "@/app/_components/poemario-comment-thread";
import { getPoemarioCommentPageData } from "@/lib/poemario-posts";
import { PUBLIC_FEED_PATH } from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const FALLBACK_TITLE = "no hay diferencias entre esto y un poemario";

type PoemarioCommentPageProps = {
  params: Promise<{ commentId: string; id: string }>;
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
}: PoemarioCommentPageProps): Promise<Metadata> {
  const { commentId, id } = await params;
  const data = await getPoemarioCommentPageData(id, commentId);

  if (!data) {
    return {
      description: "",
      title: FALLBACK_TITLE,
    };
  }

  const title = getExcerpt(data.comment.text, 80) || FALLBACK_TITLE;
  const description = getExcerpt(data.comment.text, 160) || FALLBACK_TITLE;
  const url = `https://haaaaaaammmm.com${PUBLIC_FEED_PATH}/${data.post.id}/comment/${data.comment.id}`;

  return {
    description,
    openGraph: {
      description,
      locale: "es_ES",
      siteName: "yo",
      title,
      type: "article",
      url,
    },
    title,
    twitter: {
      card: "summary",
      description,
      title,
    },
  };
}

export default async function PoemarioCommentPage({
  params,
}: PoemarioCommentPageProps) {
  const { commentId, id } = await params;
  const [data, profileImageSettings] = await Promise.all([
    getPoemarioCommentPageData(id, commentId),
    getProfileImageSettings(),
  ]);

  if (!data) {
    notFound();
  }

  const postHref = `${PUBLIC_FEED_PATH}/${data.post.id}`;
  const profileImageUrl = profileImageSettings.profileImageUrl;

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to poemario post"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={postHref}
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
            <AdminPostLink />
          </div>
        </header>

        <section aria-label="Post context">
          <ol>
            <FeedPostCard
              href={postHref}
              post={{
                commentCount: data.post.commentCount,
                content: data.post.content,
                createdAt: data.post.createdAt,
                id: data.post.id,
              }}
              profileImageUrl={profileImageUrl}
            />
          </ol>
        </section>

        {data.ancestors.length > 0 ? (
          <section
            aria-label="Parent comments"
            className="border-b border-neutral-800 px-4 py-2"
          >
            <ol>
              {data.ancestors.map((comment) => (
                <li className="border-l border-neutral-800 pl-3" key={comment.id}>
                  <PoemarioCommentBody
                    comment={comment}
                    profileImageUrl={profileImageUrl}
                  />
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section
          aria-label="Selected comment"
          className="border-b border-neutral-800 px-4 py-3"
        >
          <PoemarioCommentBody
            comment={data.comment}
            highlighted
            profileImageUrl={profileImageUrl}
          />
        </section>

        {data.comment.replies.length > 0 ? (
          <section
            aria-label="Replies"
            className="border-b border-neutral-800 px-4 py-2"
          >
            <PoemarioCommentList
              comments={data.comment.replies}
              profileImageUrl={profileImageUrl}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
