import type { ReactNode } from "react";
import Link from "next/link";

import LinkifiedText, {
  hasLinkifiedText,
} from "@/app/_components/linkified-text";
import ProfileImage from "@/app/_components/profile-image";

type FeedPost = {
  commentCount?: number;
  id: string;
  content: string;
  createdAt: Date;
  customAuthorAvatarUrl?: string | null;
  customAuthorName?: string | null;
};

type FeedPostCardProps = {
  action?: ReactNode;
  href?: string;
  post: FeedPost;
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

export default function FeedPostCard({
  action,
  href,
  post,
  profileImageUrl,
}: FeedPostCardProps) {
  const customAuthorName = post.customAuthorName?.trim();
  const authorName = customAuthorName || "humberto";
  const authorProfileImageUrl = customAuthorName
    ? post.customAuthorAvatarUrl
    : profileImageUrl;
  const hasContentLinks = hasLinkifiedText(post.content);
  const timestamp = (
    <time className="text-neutral-500" dateTime={post.createdAt.toISOString()}>
      {formatTimestamp(post.createdAt)}
    </time>
  );
  const content = (
    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
      <LinkifiedText text={post.content} />
    </p>
  );
  const commentCount =
    typeof post.commentCount === "number" ? (
      <span
        aria-label={`${post.commentCount} comentarios`}
        className="text-sm leading-5 text-neutral-500"
      >
        {post.commentCount}
      </span>
    ) : null;

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
                  {href ? (
                    <Link
                      aria-label={`Open post from ${formatTimestamp(
                        post.createdAt
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
            {href && !hasContentLinks ? (
              <Link className="block" href={href}>
                {content}
              </Link>
            ) : (
              content
            )}
            {commentCount ? (
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
          {action}
        </div>
      </article>
    </li>
  );
}
