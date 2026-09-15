"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import CommentCount from "@/app/_components/comment-count";
import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import LinkPreview from "@/app/_components/link-preview";
import PostOptionsMenu from "@/app/_components/post-options-menu";
import ProfileImage from "@/app/_components/profile-image";
import type { LinkPreviewData } from "@/lib/link-previews";

import { deletePostAction, updatePostAction } from "./actions";

type AdminPost = {
  blink: boolean;
  commentCount?: number;
  id: string;
  content: string;
  createdAt: string;
  customAuthorAvatarUrl?: string | null;
  customAuthorName?: string | null;
  preview?: LinkPreviewData | null;
};

type AdminPostCardProps = {
  canonicalPath: string;
  href?: string;
  post: AdminPost;
  profileImageUrl?: string | null;
};

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(date);
}

function editErrorMessage(
  reason: "auth" | "empty" | "invalid" | "not_found" | "update"
) {
  switch (reason) {
    case "auth":
      return "vuelve a iniciar sesion";
    case "empty":
      return "Escribe algo antes de guardar.";
    case "invalid":
      return "El valor de Parpadeo no es valido.";
    case "not_found":
      return "Ese post ya no existe.";
    case "update":
      return "No se pudo editar el post.";
  }
}

export default function AdminPostCard({
  canonicalPath,
  href,
  post,
  profileImageUrl,
}: AdminPostCardProps) {
  const customAuthorName = post.customAuthorName?.trim();
  const authorName = customAuthorName || "humberto";
  const authorProfileImageUrl = customAuthorName
    ? post.customAuthorAvatarUrl
    : profileImageUrl;
  const router = useRouter();
  const [content, setContent] = useState(post.content);
  const [draft, setDraft] = useState(post.content);
  const [blink, setBlink] = useState(post.blink);
  const [draftBlink, setDraftBlink] = useState(post.blink);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const createdAt = new Date(post.createdAt);
  const canSave = draft.trim().length > 0 && !isSaving;
  const hasContentLinks = hasLinkifiedText(content);
  const commentCount =
    typeof post.commentCount === "number" ? post.commentCount : null;
  const timestamp = (
    <time className="text-neutral-500" dateTime={post.createdAt}>
      {formatTimestamp(createdAt)}
    </time>
  );

  function startEditing() {
    setDraft(content);
    setDraftBlink(blink);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraft(content);
    setDraftBlink(blink);
    setError(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedContent = draft.trim();

    if (!trimmedContent) {
      setError("Escribe algo antes de guardar.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await updatePostAction(
        post.id,
        trimmedContent,
        draftBlink
      );

      if (!result.ok) {
        setError(editErrorMessage(result.reason));
        return;
      }

      setContent(result.content);
      setBlink(result.blink);
      setDraft(result.content);
      setDraftBlink(result.blink);
      setIsEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo editar el post.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <li className="border-b border-neutral-800 transition hover:bg-neutral-950">
      <article className="px-4 py-4">
        <div className="flex items-start gap-3">
          <ProfileImage
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            profileImageUrl={authorProfileImageUrl}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-5">
                  <span className="max-w-full truncate font-semibold text-white">
                    {authorName}
                  </span>
                  {href && !isEditing ? (
                    <Link
                      aria-label={`Open post from ${formatTimestamp(
                        createdAt
                      )}`}
                      href={href}
                    >
                      {timestamp}
                    </Link>
                  ) : (
                    timestamp
                  )}
                </div>
              </div>
            </div>

            {isEditing ? (
              <form className="mt-1" onSubmit={handleSubmit}>
                <textarea
                  autoFocus
                  className="min-h-32 w-full resize-y rounded-2xl border border-transparent bg-black px-1 text-md leading-7 text-white outline-none transition placeholder:text-neutral-500 "
                  name="content"
                  onChange={(event) => setDraft(event.target.value)}
                  required
                  rows={Math.max(3, draft.split("\n").length)}
                  value={draft}
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
                  <input
                    checked={draftBlink}
                    className="h-4 w-4 accent-[#ff003c]"
                    onChange={(event) => setDraftBlink(event.target.checked)}
                    type="checkbox"
                  />
                  Parpadeo
                </label>
                {error ? (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                ) : null}
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-neutral-900 pt-3">
                  <button
                    className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                    disabled={isSaving}
                    onClick={cancelEditing}
                    type="button"
                  >
                    cancelar
                  </button>
                  <button
                    className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                    disabled={!canSave}
                    type="submit"
                  >
                    {isSaving ? "guardando" : "guardar"}
                  </button>
                </div>
              </form>
            ) : href && !hasContentLinks ? (
              <Link className="block" href={href}>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                  <LinkifiedText text={content} />
                </p>
              </Link>
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                <LinkifiedText text={content} />
              </p>
            )}
            {!isEditing ? <LinkPreview preview={post.preview} /> : null}
            {!isEditing && commentCount !== null ? (
              <div className="mt-1.5 flex items-center">
                <CommentCount count={commentCount} href={href} />
              </div>
            ) : null}
          </div>

          <PostOptionsMenu
            canonicalPath={canonicalPath}
            deleteAction={deletePostAction}
            deleteValue={post.id}
            onEdit={startEditing}
          />
        </div>
      </article>
    </li>
  );
}
