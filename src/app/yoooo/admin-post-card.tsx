"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import ProfileImage from "@/app/_components/profile-image";

import { updatePostAction } from "./actions";
import DeletePostMenu from "./delete-post-menu";

type AdminPost = {
  commentCount?: number;
  id: string;
  content: string;
  createdAt: string;
  customAuthorAvatarUrl?: string | null;
  customAuthorName?: string | null;
};

type AdminPostCardProps = {
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

function editErrorMessage(reason: "auth" | "empty" | "not_found" | "update") {
  switch (reason) {
    case "auth":
      return "vuelve a iniciar sesion";
    case "empty":
      return "Escribe algo antes de guardar.";
    case "not_found":
      return "Ese post ya no existe.";
    case "update":
      return "No se pudo editar el post.";
  }
}

export default function AdminPostCard({
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
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const createdAt = new Date(post.createdAt);
  const canSave = draft.trim().length > 0 && !isSaving;
  const commentCount =
    typeof post.commentCount === "number" ? (
      <span
        aria-label={`${post.commentCount} comentarios`}
        className="text-sm leading-5 text-neutral-500"
      >
        {post.commentCount}
      </span>
    ) : null;
  const timestamp = (
    <time className="text-neutral-500" dateTime={post.createdAt}>
      {formatTimestamp(createdAt)}
    </time>
  );

  function startEditing() {
    setDraft(content);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraft(content);
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
      const result = await updatePostAction(post.id, trimmedContent);

      if (!result.ok) {
        setError(editErrorMessage(result.reason));
        return;
      }

      setContent(result.content);
      setDraft(result.content);
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
            ) : (
              href ? (
                <Link className="block" href={href}>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                    {content}
                  </p>
                </Link>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                  {content}
                </p>
              )
            )}
            {!isEditing && commentCount ? (
              <div className="mt-2 flex items-center gap-2">
                {href ? (
                  <Link
                    aria-label={`${post.commentCount} comentarios`}
                    className="rounded-full text-sm leading-5 text-neutral-500 transition hover:text-[#ff003c]"
                    href={href}
                  >
                    {post.commentCount}
                  </Link>
                ) : (
                  commentCount
                )}
              </div>
            ) : null}
          </div>

          <DeletePostMenu onEdit={startEditing} postId={post.id} />
        </div>
      </article>
    </li>
  );
}
