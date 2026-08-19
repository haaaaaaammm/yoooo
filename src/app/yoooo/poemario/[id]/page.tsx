import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import FeedPostCard from "@/app/_components/feed-post-card";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPoemarioPostWithThread } from "@/lib/poemario-posts";
import { ADMIN_PATH, PUBLIC_FEED_PATH } from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

import CommentThreadManager from "./comment-thread-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "poemario",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminPoemarioPostPageProps = {
  params: Promise<{ id: string }>;
};

type PoemarioThread = NonNullable<
  Awaited<ReturnType<typeof getPoemarioPostWithThread>>
>["thread"];

type SerializedPoemarioComment = {
  createdAt: string;
  id: string;
  parentId: string | null;
  postId: string;
  replies: SerializedPoemarioComment[];
  text: string;
  updatedAt: string;
};

function serializeComments(
  comments: PoemarioThread
): SerializedPoemarioComment[] {
  return comments.map((comment) => ({
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    parentId: comment.parentId,
    postId: comment.postId,
    replies: serializeComments(comment.replies),
    text: comment.text,
    updatedAt: comment.updatedAt.toISOString(),
  }));
}

export default async function AdminPoemarioPostPage({
  params,
}: AdminPoemarioPostPageProps) {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect(`${ADMIN_PATH}?error=auth`);
  }

  const { id } = await params;
  const [post, profileImageSettings] = await Promise.all([
    getPoemarioPostWithThread(id),
    getProfileImageSettings(),
  ]);

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
                aria-label="Back to poemario admin"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={`${ADMIN_PATH}?app=poemario`}
              >
                &lt;
              </Link>
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
                poemario
              </h1>
            </div>
            <Link
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              href={`${PUBLIC_FEED_PATH}/${post.id}`}
            >
              view
            </Link>
          </div>
        </header>

        <section aria-label="Original post">
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

        <CommentThreadManager
          comments={serializeComments(post.thread)}
          postId={post.id}
          profileImageUrl={profileImageSettings.profileImageUrl}
        />
      </div>
    </main>
  );
}
