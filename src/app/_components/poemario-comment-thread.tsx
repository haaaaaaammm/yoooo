import Link from "next/link";

import {
  getCommentThreadNodeClassName,
} from "@/app/_components/comment-thread-layout";
import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import ProfileImage from "@/app/_components/profile-image";
import { PUBLIC_FEED_PATH } from "@/lib/posts";

export type DisplayCommentTree = {
  authorAvatarUrl?: string | null;
  authorName?: string | null;
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  replies: DisplayCommentTree[];
  text: string;
  updatedAt: Date;
};

type PoemarioCommentThreadProps = {
  basePath?: string;
  comments: DisplayCommentTree[];
  defaultAuthorName?: string;
  profileImageUrl?: string | null;
};

type PoemarioCommentBodyProps = {
  basePath?: string;
  comment: DisplayCommentTree;
  defaultAuthorName?: string;
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

function getCommentHref(
  comment: { id: string; postId: string },
  basePath: string
) {
  return `${basePath}/${comment.postId}/comment/${comment.id}`;
}

export function PoemarioCommentBody({
  basePath = PUBLIC_FEED_PATH,
  comment,
  defaultAuthorName = "humberto",
  highlighted = false,
  href,
  profileImageUrl,
}: PoemarioCommentBodyProps) {
  const commentHref = href ?? getCommentHref(comment, basePath);
  const authorName = comment.authorName?.trim() || defaultAuthorName;
  const authorProfileImageUrl = comment.authorName?.trim()
    ? comment.authorAvatarUrl
    : profileImageUrl;
  const directReplyCount = comment.replies.length;
  const hasCommentLinks = hasLinkifiedText(comment.text);
  const heading = (
    <div className="text-sm leading-5 [overflow-wrap:anywhere]">
      <span className="font-semibold text-white">{authorName}</span>{" "}
      <time
        className="text-neutral-500"
        dateTime={comment.createdAt.toISOString()}
      >
        {formatTimestamp(comment.createdAt)}
      </time>
    </div>
  );
  const body = (
    <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-6 text-neutral-100">
      <LinkifiedText text={comment.text} />
    </p>
  );

  return (
    <article
      className={
        highlighted
          ? "min-w-0 max-w-full rounded-2xl bg-neutral-950/70 px-3 py-4"
          : "min-w-0 max-w-full py-4"
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <ProfileImage
          className="mt-1 h-9 w-9 shrink-0 rounded-full object-cover"
          profileImageUrl={authorProfileImageUrl}
        />
        <div className="min-w-0 flex-1">
          {hasCommentLinks ? (
            <>
              <Link className="block min-w-0" href={commentHref}>
                {heading}
              </Link>
              {body}
            </>
          ) : (
            <Link className="block min-w-0" href={commentHref}>
              {heading}
              {body}
            </Link>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Link
              aria-label={`${directReplyCount} respuestas`}
              className="rounded-full text-sm leading-5 text-neutral-500 transition hover:text-[#ff003c]"
              href={commentHref}
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
  basePath,
  comment,
  defaultAuthorName,
  depth,
  highlightedCommentId,
  profileImageUrl,
}: {
  basePath: string;
  comment: DisplayCommentTree;
  defaultAuthorName: string;
  depth: number;
  highlightedCommentId?: string;
  profileImageUrl?: string | null;
}) {
  return (
    <li className={getCommentThreadNodeClassName(depth)}>
      <PoemarioCommentBody
        basePath={basePath}
        comment={comment}
        defaultAuthorName={defaultAuthorName}
        highlighted={comment.id === highlightedCommentId}
        profileImageUrl={profileImageUrl}
      />

      {comment.replies.length > 0 ? (
        <ol className="min-w-0 max-w-full">
          {comment.replies.map((reply) => (
            <CommentNode
              basePath={basePath}
              comment={reply}
              defaultAuthorName={defaultAuthorName}
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
  basePath = PUBLIC_FEED_PATH,
  comments,
  defaultAuthorName = "humberto",
  highlightedCommentId,
  profileImageUrl,
}: PoemarioCommentThreadProps & {
  highlightedCommentId?: string;
}) {
  return (
    <ol className="min-w-0 max-w-full">
      {comments.map((comment) => (
        <CommentNode
          basePath={basePath}
          comment={comment}
          defaultAuthorName={defaultAuthorName}
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
  basePath = PUBLIC_FEED_PATH,
  comments,
  defaultAuthorName = "humberto",
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
        basePath={basePath}
        comments={comments}
        defaultAuthorName={defaultAuthorName}
        profileImageUrl={profileImageUrl}
      />
    </section>
  );
}
