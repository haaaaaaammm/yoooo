import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth";
import type { LinkPreviewData } from "@/lib/link-previews";
import { getPoemarioCommentPageData } from "@/lib/poemario-posts";
import { ADMIN_PATH, PUBLIC_FEED_PATH } from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

import CommentThreadManager from "../../comment-thread-manager";
import AdminPostCard from "../../../../admin-post-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "poemario",
};

type AdminPoemarioCommentPageProps = {
  params: Promise<{ commentId: string; id: string }>;
};

type CommentPageData = NonNullable<
  Awaited<ReturnType<typeof getPoemarioCommentPageData>>
>;

type SerializedPoemarioComment = {
  createdAt: string;
  id: string;
  parentId: string | null;
  postId: string;
  preview: LinkPreviewData | null;
  replies: SerializedPoemarioComment[];
  text: string;
  updatedAt: string;
};

function serializeCommentFields(
  comment: CommentPageData["comment"]
): Omit<SerializedPoemarioComment, "replies"> {
  return {
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    parentId: comment.parentId,
    postId: comment.postId,
    preview: comment.preview,
    text: comment.text,
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function serializeComment(
  comment: CommentPageData["comment"]
): SerializedPoemarioComment {
  return {
    ...serializeCommentFields(comment),
    replies: comment.replies.map(serializeComment),
  };
}

function serializeAncestorChain(
  ancestors: CommentPageData["ancestors"]
): SerializedPoemarioComment[] {
  let chain: SerializedPoemarioComment[] = [];

  for (const ancestor of [...ancestors].reverse()) {
    chain = [
      {
        ...serializeCommentFields(ancestor),
        replies: chain,
      },
    ];
  }

  return chain;
}

export default async function AdminPoemarioCommentPage({
  params,
}: AdminPoemarioCommentPageProps) {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect(`${ADMIN_PATH}?error=auth`);
  }

  const { commentId, id } = await params;
  const [data, profileImageSettings] = await Promise.all([
    getPoemarioCommentPageData(id, commentId),
    getProfileImageSettings(),
  ]);

  if (!data) {
    notFound();
  }

  const adminPostHref = `${ADMIN_PATH}/poemario/${data.post.id}`;
  const profileImageUrl = profileImageSettings.profileImageUrl;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to poemario admin post"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={adminPostHref}
              >
                &lt;
              </Link>
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
                poemario
              </h1>
            </div>
            <Link
              className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              href={`${PUBLIC_FEED_PATH}/${data.post.id}/comment/${data.comment.id}`}
            >
              view
            </Link>
          </div>
        </header>

        <section aria-label="Post context">
          <ol>
            <AdminPostCard
              canonicalPath={`${PUBLIC_FEED_PATH}/${data.post.id}`}
              href={adminPostHref}
              post={{
                blink: data.post.blink,
                commentCount: data.post.commentCount,
                content: data.post.content,
                createdAt: data.post.createdAt.toISOString(),
                customAuthorAvatarUrl: data.post.customAuthorAvatarUrl,
                customAuthorName: data.post.customAuthorName,
                id: data.post.id,
                preview: data.post.preview,
              }}
              profileImageUrl={profileImageUrl}
            />
          </ol>
        </section>

        {data.ancestors.length > 0 ? (
          <CommentThreadManager
            comments={serializeAncestorChain(data.ancestors)}
            postId={data.post.id}
            profileImageUrl={profileImageUrl}
            showComposer={false}
          />
        ) : null}

        <CommentThreadManager
          comments={[serializeComment(data.comment)]}
          highlightedCommentId={data.comment.id}
          postId={data.post.id}
          profileImageUrl={profileImageUrl}
          showComposer={false}
        />
      </div>
    </main>
  );
}
