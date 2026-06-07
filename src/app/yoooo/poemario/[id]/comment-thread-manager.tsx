"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ProfileImage from "@/app/_components/profile-image";
import { ADMIN_PATH } from "@/lib/posts";

import {
  createPoemarioCommentAction,
  deletePoemarioCommentAction,
  updatePoemarioCommentAction,
} from "../../actions";

type AdminPoemarioComment = {
  createdAt: string;
  id: string;
  parentId: string | null;
  postId: string;
  replies: AdminPoemarioComment[];
  text: string;
  updatedAt: string;
};

type CommentThreadManagerProps = {
  comments: AdminPoemarioComment[];
  emptyMessage?: string;
  highlightedCommentId?: string;
  postId: string;
  profileImageUrl?: string | null;
  showComposer?: boolean;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function getAdminCommentHref(comment: { id: string; postId: string }) {
  return `${ADMIN_PATH}/poemario/${comment.postId}/comment/${comment.id}`;
}

function CommentForm({
  autoFocus,
  initialValue = "",
  onCancel,
  onSubmit,
  placeholder,
  submitLabel,
}: {
  autoFocus?: boolean;
  initialValue?: string;
  onCancel?: () => void;
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [text, setText] = useState(initialValue);
  const canSave = text.trim().length > 0 && !isSaving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      setError("Escribe algo antes de guardar.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSubmit(trimmedText);
      setText("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo guardar."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <textarea
        autoFocus={autoFocus}
        className="min-h-24 w-full resize-y rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base leading-7 text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        value={text}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            cancelar
          </button>
        ) : null}
        <button
          className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
          disabled={!canSave}
          type="submit"
        >
          {isSaving ? "guardando" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  depth,
  highlightedCommentId,
  onSuccess,
  profileImageUrl,
}: {
  comment: AdminPoemarioComment;
  depth: number;
  highlightedCommentId?: string;
  onSuccess: (message: string) => void;
  profileImageUrl?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const isHighlighted = comment.id === highlightedCommentId;
  const visualDepth = Math.min(depth, 3);
  const commentHref = getAdminCommentHref(comment);
  const directReplyCount = comment.replies.length;

  async function addReply(text: string) {
    const result = await createPoemarioCommentAction(
      comment.postId,
      comment.id,
      text
    );

    if (!result.ok) {
      throw new Error(result.message);
    }

    setIsReplying(false);
    onSuccess("respuesta guardada");
    router.refresh();
  }

  async function saveEdit(text: string) {
    const result = await updatePoemarioCommentAction(comment.id, text);

    if (!result.ok) {
      throw new Error(result.message);
    }

    setIsEditing(false);
    onSuccess("comentario actualizado");
    router.refresh();
  }

  async function deleteComment() {
    if (!window.confirm("borrar comentario y sus respuestas?")) {
      return;
    }

    setError(null);

    try {
      const result = await deletePoemarioCommentAction(comment.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      onSuccess("comentario borrado");
      router.refresh();
    } catch {
      setError("No se pudo borrar el comentario.");
    }
  }

  return (
    <li
      className={depth > 0 ? "border-l border-neutral-800 pl-3" : undefined}
      style={depth > 0 ? { marginLeft: `${visualDepth * 0.6}rem` } : undefined}
    >
      <article
        className={
          isHighlighted
            ? "rounded-2xl bg-neutral-950/70 px-3 py-4"
            : "py-4"
        }
      >
        <div className="flex min-w-0 items-start gap-3">
          <ProfileImage
            className="mt-1 h-9 w-9 shrink-0 rounded-full object-cover"
            profileImageUrl={profileImageUrl}
          />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div>
                <div className="text-sm leading-5">
                  <span className="font-semibold text-white">humberto</span>{" "}
                  <time className="text-neutral-500" dateTime={comment.createdAt}>
                    {formatTimestamp(comment.createdAt)}
                  </time>
                </div>
                <div className="mt-3">
                  <CommentForm
                    autoFocus
                    initialValue={comment.text}
                    onCancel={() => setIsEditing(false)}
                    onSubmit={saveEdit}
                    placeholder="editar comentario"
                    submitLabel="guardar"
                  />
                </div>
              </div>
            ) : (
              <Link className="block min-w-0" href={commentHref}>
                <div className="text-sm leading-5">
                  <span className="font-semibold text-white">humberto</span>{" "}
                  <time className="text-neutral-500" dateTime={comment.createdAt}>
                    {formatTimestamp(comment.createdAt)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
                  {comment.text}
                </p>
              </Link>
            )}

            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

            {!isEditing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  aria-label={`${directReplyCount} respuestas`}
                  className="rounded-full px-3 py-1.5 text-sm text-neutral-500 transition hover:text-[#ff003c]"
                  href={commentHref}
                >
                  {directReplyCount}
                </Link>
                <button
                  className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                  onClick={() => setIsReplying((current) => !current)}
                  type="button"
                >
                  reply
                </button>
                <button
                  className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                  onClick={() => setIsEditing(true)}
                  type="button"
                >
                  editar
                </button>
                <button
                  className="rounded-full px-3 py-1.5 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                  onClick={deleteComment}
                  type="button"
                >
                  borrar
                </button>
              </div>
            ) : null}

            {isReplying ? (
              <div className="mt-3">
                <CommentForm
                  autoFocus
                  onCancel={() => setIsReplying(false)}
                  onSubmit={addReply}
                  placeholder="respuesta"
                  submitLabel="responder"
                />
              </div>
            ) : null}

            {comment.replies.length > 0 ? (
              <ol className="mt-2">
                {comment.replies.map((reply) => (
                  <CommentItem
                    comment={reply}
                    depth={depth + 1}
                    highlightedCommentId={highlightedCommentId}
                    key={reply.id}
                    onSuccess={onSuccess}
                    profileImageUrl={profileImageUrl}
                  />
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

export default function CommentThreadManager({
  comments,
  emptyMessage = "todavia no hay comentarios",
  highlightedCommentId,
  postId,
  profileImageUrl,
  showComposer = true,
}: CommentThreadManagerProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), 5000);

    return () => clearTimeout(timer);
  }, [notice]);

  async function addTopLevelComment(text: string) {
    const result = await createPoemarioCommentAction(postId, null, text);

    if (!result.ok) {
      throw new Error(result.message);
    }

    setNotice("comentario guardado");
    router.refresh();
  }

  return (
    <section
      aria-label="Comentarios"
      className="border-b border-neutral-800 px-4 py-4"
    >
      {showComposer ? (
        <div className="space-y-3 rounded-2xl border border-neutral-800 bg-black p-3">
          <p className="text-sm text-neutral-300">comentario</p>
          <CommentForm
            onSubmit={addTopLevelComment}
            placeholder="agrega algo"
            submitLabel="comentar"
          />
        </div>
      ) : null}

      {notice ? <p className="mt-3 text-sm text-green-400">{notice}</p> : null}

      {comments.length > 0 ? (
        <ol className={showComposer ? "mt-4" : undefined}>
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              depth={0}
              highlightedCommentId={highlightedCommentId}
              key={comment.id}
              onSuccess={setNotice}
              profileImageUrl={profileImageUrl}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">{emptyMessage}</p>
      )}
    </section>
  );
}
