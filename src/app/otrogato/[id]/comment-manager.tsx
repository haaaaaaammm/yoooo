"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getCommentThreadNodeClassName,
} from "@/app/_components/comment-thread-layout";
import LinkifiedText from "@/app/_components/linkified-text";
import ProfileImage from "@/app/_components/profile-image";
import {
  DIFERENCIAS_COMMENT_MAX_LENGTH,
  DIFERENCIAS_PATH,
} from "@/lib/posts";

import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "../actions";

export type ManagedComment = {
  authorAvatarUrl: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  id: string;
  parentId: string | null;
  postId: string;
  replies: ManagedComment[];
  text: string;
  updatedAt: string;
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

function CommentForm({
  initialValue = "",
  onCancel,
  onSubmit,
  placeholder,
  submitLabel,
}: {
  initialValue?: string;
  onCancel?: () => void;
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [text, setText] = useState(initialValue);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim() || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      await onSubmit(text.trim());
      setText("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="min-w-0 max-w-full space-y-2" onSubmit={submit}>
      <textarea
        className="min-h-24 w-full min-w-0 max-w-full resize-y rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base leading-7 text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
        maxLength={DIFERENCIAS_COMMENT_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        value={text}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c]"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            cancelar
          </button>
        ) : null}
        <button
          className="rounded-full px-4 py-2 text-sm text-[#ff003c] disabled:text-neutral-500"
          disabled={!text.trim() || isPending}
          type="submit"
        >
          {isPending ? "guardando" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  currentUserId,
  depth,
}: {
  comment: ManagedComment;
  currentUserId: string;
  depth: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwner = comment.authorId === currentUserId;
  const href = `${DIFERENCIAS_PATH}/${comment.postId}/comment/${comment.id}`;

  async function reply(text: string) {
    const result = await createCommentAction(comment.postId, comment.id, text);

    if (!result.ok) {
      throw new Error(result.message);
    }

    setIsReplying(false);
    router.refresh();
  }

  async function edit(text: string) {
    const result = await updateCommentAction(comment.id, text);

    if (!result.ok) {
      throw new Error(result.message);
    }

    setIsEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("borrar comentario y sus respuestas?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteCommentAction(comment.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo borrar el comentario.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <li
      className={getCommentThreadNodeClassName(depth)}
      id={`comment-${comment.id}`}
    >
      <article className="min-w-0 max-w-full py-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileImage
            className="mt-1 h-9 w-9 shrink-0 rounded-full object-cover"
            profileImageUrl={comment.authorAvatarUrl}
          />
          <div className="min-w-0 flex-1">
            <Link className="block min-w-0" href={href}>
              <div className="text-sm leading-5 [overflow-wrap:anywhere]">
                <span className="font-semibold text-white">
                  {comment.authorName}
                </span>{" "}
                <time className="text-neutral-500" dateTime={comment.createdAt}>
                  {formatTimestamp(comment.createdAt)}
                </time>
              </div>
            </Link>

            {isEditing ? (
              <div className="mt-3">
                <CommentForm
                  initialValue={comment.text}
                  onCancel={() => setIsEditing(false)}
                  onSubmit={edit}
                  placeholder="editar comentario"
                  submitLabel="guardar"
                />
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-6 text-neutral-100">
                <LinkifiedText text={comment.text} />
              </p>
            )}

            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

            {!isEditing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  className="rounded-full px-3 py-1.5 text-sm text-neutral-500 transition hover:text-[#ff003c]"
                  href={href}
                >
                  {comment.replies.length}
                </Link>
                <button
                  className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] hover:bg-[#ff003c]/10"
                  onClick={() => setIsReplying((current) => !current)}
                  type="button"
                >
                  reply
                </button>
                {isOwner ? (
                  <>
                    <button
                      className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] hover:bg-[#ff003c]/10"
                      onClick={() => setIsEditing(true)}
                      type="button"
                    >
                      editar
                    </button>
                    <button
                      className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] hover:bg-[#ff003c]/10 disabled:text-neutral-500"
                      disabled={isDeleting}
                      onClick={remove}
                      type="button"
                    >
                      {isDeleting ? "borrando" : "borrar"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {isReplying ? (
              <div className="mt-3">
                <CommentForm
                  onCancel={() => setIsReplying(false)}
                  onSubmit={reply}
                  placeholder="respuesta"
                  submitLabel="responder"
                />
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {comment.replies.length > 0 ? (
        <ol className="min-w-0 max-w-full">
          {comment.replies.map((replyComment) => (
            <CommentItem
              comment={replyComment}
              currentUserId={currentUserId}
              depth={depth + 1}
              key={replyComment.id}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export default function CommentManager({
  comments,
  currentUserId,
  postId,
}: {
  comments: ManagedComment[];
  currentUserId: string;
  postId: string;
}) {
  const router = useRouter();

  async function addComment(text: string) {
    const result = await createCommentAction(postId, null, text);

    if (!result.ok) {
      throw new Error(result.message);
    }

    router.refresh();
  }

  return (
    <section className="border-b border-neutral-800 px-4 py-4">
      <div className="space-y-3 rounded-2xl border border-neutral-800 bg-black p-3">
        <p className="text-sm text-neutral-300">comentario</p>
        <CommentForm
          onSubmit={addComment}
          placeholder="agrega algo"
          submitLabel="comentar"
        />
      </div>

      {comments.length > 0 ? (
        <ol className="mt-4 min-w-0 max-w-full">
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              depth={0}
              key={comment.id}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          todavia no hay comentarios
        </p>
      )}
    </section>
  );
}
