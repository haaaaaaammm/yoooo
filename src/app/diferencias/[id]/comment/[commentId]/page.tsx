import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FeedPostCard from "@/app/_components/feed-post-card";
import {
  PoemarioCommentBody,
  PoemarioCommentList,
} from "@/app/_components/poemario-comment-thread";
import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import { getDiferenciasCommentPageData } from "@/lib/diferencias-posts";
import { DIFERENCIAS_PATH, OTROGATO_PATH } from "@/lib/posts";

export const dynamic = "force-dynamic";

type DiferenciasCommentPageProps = {
  params: Promise<{ commentId: string; id: string }>;
};

function getExcerpt(value: string, maxLength: number) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  return excerpt.length <= maxLength
    ? excerpt
    : `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: DiferenciasCommentPageProps): Promise<Metadata> {
  const { commentId, id } = await params;
  const data = await getDiferenciasCommentPageData(id, commentId);

  if (!data) {
    return { description: "", title: "diferencias" };
  }

  const title = getExcerpt(data.comment.text, 80) || "diferencias";
  const description = getExcerpt(data.comment.text, 160) || "diferencias";
  const url = `https://haaaaaaammmm.com${DIFERENCIAS_PATH}/${data.post.id}/comment/${data.comment.id}`;

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
    twitter: { card: "summary", description, title },
  };
}

export default async function DiferenciasCommentPage({
  params,
}: DiferenciasCommentPageProps) {
  const { commentId, id } = await params;
  const [data, sessionUser] = await Promise.all([
    getDiferenciasCommentPageData(id, commentId),
    getDiferenciasSessionUser(),
  ]);

  if (!data) {
    notFound();
  }

  const postHref = `${DIFERENCIAS_PATH}/${data.post.id}`;

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to diferencias post"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={postHref}
              >
                &lt;
              </Link>
              <Link
                className="min-w-0 truncate text-xl font-semibold tracking-wide text-white"
                href={DIFERENCIAS_PATH}
              >
                diferencias
              </Link>
            </div>
            {sessionUser ? (
              <Link
                className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={OTROGATO_PATH}
              >
                Post
              </Link>
            ) : null}
          </div>
        </header>

        <section aria-label="Post context">
          <ol>
            <FeedPostCard href={postHref} post={data.post} />
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
                    basePath={DIFERENCIAS_PATH}
                    comment={comment}
                    defaultAuthorName="usuario"
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
            basePath={DIFERENCIAS_PATH}
            comment={data.comment}
            defaultAuthorName="usuario"
            highlighted
          />
        </section>

        {data.comment.replies.length > 0 ? (
          <section
            aria-label="Replies"
            className="border-b border-neutral-800 px-4 py-2"
          >
            <PoemarioCommentList
              basePath={DIFERENCIAS_PATH}
              comments={data.comment.replies}
              defaultAuthorName="usuario"
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
