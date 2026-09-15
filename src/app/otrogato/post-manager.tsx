"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import CommentCount from "@/app/_components/comment-count";
import FeedPostCard from "@/app/_components/feed-post-card";
import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import LinkPreview from "@/app/_components/link-preview";
import PostOptionsMenu from "@/app/_components/post-options-menu";
import ProfileImage from "@/app/_components/profile-image";
import type { LinkPreviewData } from "@/lib/link-previews";
import {
  DIFERENCIAS_CONTENT_MAX_LENGTH,
  OTROGATO_PATH,
} from "@/lib/posts";

import { deletePostAction, updatePostAction } from "./actions";

export type ManagedPost = {
  avatarUrl: string | null;
  commentCount: number;
  content: string;
  createdAt: string;
  displayName: string;
  id: string;
  isOwner: boolean;
  preview?: LinkPreviewData | null;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Mexico_City",
    year: "numeric",
  }).format(new Date(value));
}

function PostItem({ post }: { post: ManagedPost }) {
  const router = useRouter();
  const [content, setContent] = useState(post.content);
  const [draft, setDraft] = useState(post.content);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const result = await updatePostAction(post.id, draft);

      if (!result.ok || !result.content) {
        setError(result.message);
        return;
      }

      setContent(result.content);
      setDraft(result.content);
      setIsEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo editar el post.");
    } finally {
      setIsPending(false);
    }
  }

  async function remove() {
    setIsPending(true);
    setError(null);

    try {
      const result = await deletePostAction(post.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo borrar el post.");
    } finally {
      setIsPending(false);
    }
  }

  if (!post.isOwner) {
    return (
      <FeedPostCard
        href={`${OTROGATO_PATH}/${post.id}`}
        post={{
          commentCount: post.commentCount,
          content: post.content,
          createdAt: new Date(post.createdAt),
          customAuthorAvatarUrl: post.avatarUrl,
          customAuthorName: post.displayName,
          id: post.id,
          preview: post.preview,
        }}
      />
    );
  }

  return (
    <li className="border-b border-neutral-800 transition hover:bg-neutral-950">
      <article className="px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileImage
            className="h-10 w-10 flex-none rounded-full object-cover"
            profileImageUrl={post.avatarUrl}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm leading-5">
              <span className="max-w-full truncate font-semibold text-white">
                {post.displayName}
              </span>
              <Link
                className="text-neutral-500"
                href={`${OTROGATO_PATH}/${post.id}`}
              >
                {formatTimestamp(post.createdAt)}
              </Link>
            </div>

            {isEditing ? (
              <form className="mt-2" onSubmit={save}>
                <textarea
                  autoFocus
                  className="min-h-32 w-full resize-y rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base leading-7 text-white outline-none transition focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                  maxLength={DIFERENCIAS_CONTENT_MAX_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  required
                  value={draft}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="rounded-full px-4 py-2 text-sm text-[#ff003c]"
                    disabled={isPending}
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    cancelar
                  </button>
                  <button
                    className="rounded-full px-4 py-2 text-sm text-[#ff003c] disabled:text-neutral-500"
                    disabled={isPending || !draft.trim()}
                    type="submit"
                  >
                    {isPending ? "guardando" : "guardar"}
                  </button>
                </div>
              </form>
            ) : hasLinkifiedText(content) ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                <LinkifiedText text={content} />
              </p>
            ) : (
              <Link className="block" href={`${OTROGATO_PATH}/${post.id}`}>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                  <LinkifiedText text={content} />
                </p>
              </Link>
            )}

            {!isEditing ? <LinkPreview preview={post.preview} /> : null}

            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
            {!isEditing ? (
              <div className="mt-1.5 flex items-center">
                <CommentCount
                  count={post.commentCount}
                  href={`${OTROGATO_PATH}/${post.id}`}
                />
              </div>
            ) : null}
          </div>

          <PostOptionsMenu
            canonicalPath={`${OTROGATO_PATH}/${post.id}`}
            isDeleting={isPending}
            onDelete={remove}
            onEdit={() => {
              setDraft(content);
              setIsEditing(true);
            }}
          />
        </div>
      </article>
    </li>
  );
}

export default function PostManager({ posts }: { posts: ManagedPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
        todavia no hay posts
      </p>
    );
  }

  return (
    <ol>
      {posts.map((post) => (
        <PostItem key={post.id} post={post} />
      ))}
    </ol>
  );
}
