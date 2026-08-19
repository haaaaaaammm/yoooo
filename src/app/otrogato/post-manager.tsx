"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import ProfileImage from "@/app/_components/profile-image";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(post.content);
  const [draft, setDraft] = useState(post.content);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

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
    if (!window.confirm("delete?")) {
      return;
    }

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

            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
            {!isEditing ? (
              <Link
                className="mt-2 inline-block text-sm text-neutral-500 transition hover:text-[#ff003c]"
                href={`${OTROGATO_PATH}/${post.id}`}
              >
                {post.commentCount}
              </Link>
            ) : null}
          </div>

          <div className="relative z-10 shrink-0" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-label="Open post menu"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              ...
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-xl shadow-black">
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-[#ff003c] hover:bg-[#ff003c]/10"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraft(content);
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  editar
                </button>
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-[#ff003c] hover:bg-[#ff003c]/10 disabled:text-neutral-500"
                  disabled={isPending}
                  onClick={remove}
                  type="button"
                >
                  {isPending ? "deleteando" : "deletealo"}
                </button>
              </div>
            ) : null}
          </div>
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
