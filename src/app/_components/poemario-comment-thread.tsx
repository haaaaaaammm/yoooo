import Link from "next/link";

import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import ProfileImage from "@/app/_components/profile-image";
import type { PoemarioCommentTree } from "@/lib/poemario-posts";
import { PUBLIC_FEED_PATH } from "@/lib/posts";

type PoemarioCommentThreadProps = {
  comments: PoemarioCommentTree[];
  profileImageUrl?: string | null;
};

type PoemarioCommentBodyProps = {
  comment: PoemarioCommentTree;
  highlighted?: boolean;
  href?: string;
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

export function getPoemarioCommentHref(comment: {
  id: string;
  postId: string;
}) {
  return `${PUBLIC_FEED_PATH}/${comment.postId}/comment/${comment.id}`;
}

export function PoemarioCommentBody({
  comment,
  highlighted = false,
  href = getPoemarioCommentHref(comment),
  profileImageUrl,
}: PoemarioCommentBodyProps) {
  const directReplyCount = comment.replies.length;
  const hasCommentLinks = hasLinkifiedText(comment.text);
  const heading = (
    <div className="text-sm leading-5">
      <span className="font-semibold text-white">humberto</span>{" "}
      <time
        className="text-neutral-500"
        dateTime={comment.createdAt.toISOString()}
      >
        {formatTimestamp(comment.createdAt)}
      </time>
    </div>
  );
  const body = (
    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
      <LinkifiedText text={comment.text} />
    </p>
  );

  return (
    <article
      className={
        highlighted
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
          {hasCommentLinks ? (
            <>
              <Link className="block min-w-0" href={href}>
                {heading}
              </Link>
              {body}
            </>
          ) : (
            <Link className="block min-w-0" href={href}>
              {heading}
              {body}
            </Link>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Link
              aria-label={`${directReplyCount} respuestas`}
              className="rounded-full text-sm leading-5 text-neutral-500 transition hover:text-[#ff003c]"
              href={href}
            >
              {directReplyCount}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function CommentNode({
  comment,
  depth,
  highlightedCommentId,
  profileImageUrl,
}: {
  comment: PoemarioCommentTree;
  depth: number;
  highlightedCommentId?: string;
  profileImageUrl?: string | null;
}) {
  const visualDepth = Math.min(depth, 3);

  return (
    <li
      className={depth > 0 ? "border-l border-neutral-800 pl-3" : undefined}
      style={depth > 0 ? { marginLeft: `${visualDepth * 0.6}rem` } : undefined}
    >
      <PoemarioCommentBody
        comment={comment}
        highlighted={comment.id === highlightedCommentId}
        profileImageUrl={profileImageUrl}
      />

      {comment.replies.length > 0 ? (
        <ol>
          {comment.replies.map((reply) => (
            <CommentNode
              comment={reply}
              depth={depth + 1}
              highlightedCommentId={highlightedCommentId}
              key={reply.id}
              profileImageUrl={profileImageUrl}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function PoemarioCommentList({
  comments,
  highlightedCommentId,
  profileImageUrl,
}: PoemarioCommentThreadProps & {
  highlightedCommentId?: string;
}) {
  return (
    <ol>
      {comments.map((comment) => (
        <CommentNode
          comment={comment}
          depth={0}
          highlightedCommentId={highlightedCommentId}
          key={comment.id}
          profileImageUrl={profileImageUrl}
        />
      ))}
    </ol>
  );
}

export default function PoemarioCommentThread({
  comments,
  profileImageUrl,
}: PoemarioCommentThreadProps) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Comentarios"
      className="border-b border-neutral-800 px-4 py-2"
    >
      <PoemarioCommentList
        comments={comments}
        profileImageUrl={profileImageUrl}
      />
    </section>
  );
}
