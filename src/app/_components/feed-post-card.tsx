import type { ReactNode } from "react";

import ProfileImage from "@/app/_components/profile-image";

type FeedPost = {
  id: string;
  content: string;
  createdAt: Date;
};

type FeedPostCardProps = {
  action?: ReactNode;
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
  post,
  profileImageUrl,
}: FeedPostCardProps) {
  return (
    <li className="border-b border-neutral-800 transition hover:bg-neutral-950">
      <article className="px-4 py-4">
        <div className="flex items-start gap-3">
          <ProfileImage
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            profileImageUrl={profileImageUrl}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-5">
                  <span className="max-w-full truncate font-semibold text-white">
                    humberto
                  </span>
                  <time
                    className="text-neutral-500"
                    dateTime={post.createdAt.toISOString()}
                  >
                    {formatTimestamp(post.createdAt)}
                  </time>
                </div>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">{post.content}</p>
          </div>
              {action}

        </div>

      </article>
    </li>
  );
}
