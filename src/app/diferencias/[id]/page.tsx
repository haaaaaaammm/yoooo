import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CopyLinkButton from "@/app/_components/copy-link-button";
import FeedPostCard from "@/app/_components/feed-post-card";
import PoemarioCommentThread from "@/app/_components/poemario-comment-thread";
import CommentManager, {
  type ManagedComment,
} from "@/app/otrogato/[id]/comment-manager";
import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import {
  getDiferenciasPostById,
  getDiferenciasPostWithThread,
  type DiferenciasCommentTree,
} from "@/lib/diferencias-posts";
import { DIFERENCIAS_PATH, OTROGATO_PATH } from "@/lib/posts";

export const dynamic = "force-dynamic";

type DiferenciasPostPageProps = {
  params: Promise<{ id: string }>;
};

function serializeComment(comment: DiferenciasCommentTree): ManagedComment {
  return {
    authorAvatarUrl: comment.authorAvatarUrl,
    authorId: comment.authorId,
    authorName: comment.authorName,
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    parentId: comment.parentId,
    postId: comment.postId,
    replies: comment.replies.map(serializeComment),
    text: comment.text,
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function getExcerpt(value: string, maxLength: number) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  return excerpt.length <= maxLength
    ? excerpt
    : `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: DiferenciasPostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getDiferenciasPostById(id);

  if (!post) {
    return { description: "", title: "diferencias" };
  }

  const description = getExcerpt(post.content, 160) || "diferencias";
  const url = `https://haaaaaaammmm.com${DIFERENCIAS_PATH}/${post.id}`;

  return {
    description,
    openGraph: {
      description,
      locale: "es_ES",
      siteName: "yo",
      title: "diferencias",
      type: "article",
      url,
    },
    title: "diferencias",
    twitter: { card: "summary", description, title: "diferencias" },
  };
}

export default async function DiferenciasPostPage({
  params,
}: DiferenciasPostPageProps) {
  const { id } = await params;
  const [post, sessionUser] = await Promise.all([
    getDiferenciasPostWithThread(id),
    getDiferenciasSessionUser(),
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
                aria-label="Back to diferencias"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={DIFERENCIAS_PATH}
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
            <div className="flex flex-none items-center gap-2">
              <CopyLinkButton />
              {sessionUser ? (
                <Link
                  className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                  href={OTROGATO_PATH}
                >
                  Post
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <section aria-label="Post">
          <ol>
            <FeedPostCard post={post} />
          </ol>
        </section>

        {sessionUser ? (
          <CommentManager
            comments={post.thread.map(serializeComment)}
            currentUserId={sessionUser.id}
            postId={post.id}
          />
        ) : (
          <PoemarioCommentThread
            basePath={DIFERENCIAS_PATH}
            comments={post.thread}
            defaultAuthorName="usuario"
          />
        )}
      </div>
    </main>
  );
}
