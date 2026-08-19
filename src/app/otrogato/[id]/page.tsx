import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import FeedPostCard from "@/app/_components/feed-post-card";
import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import {
  getDiferenciasPostWithThread,
  type DiferenciasCommentTree,
} from "@/lib/diferencias-posts";
import { DIFERENCIAS_PATH, OTROGATO_PATH } from "@/lib/posts";

import CommentManager, { type ManagedComment } from "./comment-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "otrogato",
};

type OtrogatoPostPageProps = {
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

export default async function OtrogatoPostPage({
  params,
}: OtrogatoPostPageProps) {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    redirect(OTROGATO_PATH);
  }

  const { id } = await params;
  const post = await getDiferenciasPostWithThread(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to otrogato"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={OTROGATO_PATH}
              >
                &lt;
              </Link>
              <h1 className="truncate text-xl font-semibold text-white">
                otrogato
              </h1>
            </div>
            <Link
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              href={`${DIFERENCIAS_PATH}/${post.id}`}
            >
              view
            </Link>
          </div>
        </header>

        <section aria-label="Post">
          <ol>
            <FeedPostCard post={post} />
          </ol>
        </section>

        <CommentManager
          comments={post.thread.map(serializeComment)}
          currentUserId={user.id}
          postId={post.id}
        />
      </div>
    </main>
  );
}
