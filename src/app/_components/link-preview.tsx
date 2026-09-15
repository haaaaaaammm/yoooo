import Link from "next/link";
import type { ReactNode } from "react";

import CommentCount from "@/app/_components/comment-count";
import LinkPreviewImage from "@/app/_components/link-preview-image";
import ProfileImage from "@/app/_components/profile-image";
import type { LinkPreviewData } from "@/lib/link-previews";
import { isOwnSiteUrl } from "@/lib/site-url";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City",
    year: "numeric",
  }).format(new Date(value));
}

function PreviewLink({
  children,
  className,
  preview,
}: {
  children: ReactNode;
  className: string;
  preview: LinkPreviewData;
}) {
  const url = new URL(preview.url);

  return isOwnSiteUrl(url) ? (
    <Link
      aria-label="Open link preview"
      className={className}
      href={`${url.pathname}${url.search}${url.hash}`}
    >
      {children}
    </Link>
  ) : (
    <a
      aria-label="Open link preview"
      className={className}
      href={preview.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

export default function LinkPreview({
  preview,
}: {
  preview?: LinkPreviewData | null;
}) {
  if (!preview) {
    return null;
  }

  if (preview.kind === "unavailable") {
    return (
      <PreviewLink
        className="mt-3 block rounded-2xl border border-neutral-800 px-3 py-3 text-sm text-neutral-500 transition hover:border-neutral-700 hover:bg-neutral-950"
        preview={preview}
      >
        This post is no longer available.
      </PreviewLink>
    );
  }

  if (preview.kind === "internal-repost") {
    return (
      <PreviewLink
        className="mt-3 block overflow-hidden rounded-2xl border border-neutral-800 transition hover:border-neutral-700 hover:bg-neutral-950"
        preview={preview}
      >
        <div className="p-3">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {preview.authorAvatarUrl ? (
              <ProfileImage
                className="h-7 w-7 shrink-0 rounded-full object-cover"
                profileImageUrl={preview.authorAvatarUrl}
              />
            ) : null}
            {preview.authorName ? (
              <span className="min-w-0 truncate font-semibold text-white">
                {preview.authorName}
              </span>
            ) : null}
            {preview.publishedAt ? (
              <time
                className="shrink-0 text-neutral-500"
                dateTime={preview.publishedAt}
              >
                {"\u00b7 "}
                {formatTimestamp(preview.publishedAt)}
              </time>
            ) : null}
          </div>
          {preview.title ? (
            <p className="mt-2 text-sm font-semibold text-neutral-100">
              {preview.title}
            </p>
          ) : null}
          {preview.description ? (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-5 text-neutral-300">
              {preview.description}
            </p>
          ) : null}
          {typeof preview.commentCount === "number" ? (
            <div className="mt-1 flex items-center">
              <CommentCount count={preview.commentCount} />
            </div>
          ) : null}
        </div>
        {preview.imageUrl ? (
          <LinkPreviewImage
            alt=""
            className="max-h-64 w-full border-t border-neutral-800 object-cover"
            src={preview.imageUrl}
          />
        ) : null}
      </PreviewLink>
    );
  }

  const domain = new URL(preview.url).hostname.replace(/^www\./, "");
  const isAppleMusic = domain === "music.apple.com";

  if (isAppleMusic) {
    return (
      <PreviewLink
        className="mt-3 flex min-w-0 overflow-hidden rounded-2xl border border-neutral-800 transition hover:border-neutral-700 hover:bg-neutral-950"
        preview={preview}
      >
        {preview.imageUrl ? (
          <LinkPreviewImage
            alt=""
            className="h-28 w-28 shrink-0 border-r border-neutral-800 object-cover sm:h-32 sm:w-32"
            src={preview.imageUrl}
          />
        ) : null}
        <div className="min-w-0 flex-1 self-center space-y-1 p-3">
          {preview.title ? (
            <p className="line-clamp-2 break-words text-sm font-semibold text-neutral-100">
              {preview.title}
            </p>
          ) : null}
          {preview.description ? (
            <p className="line-clamp-2 break-words text-sm leading-5 text-neutral-400">
              {preview.description}
            </p>
          ) : null}
          <p className="text-xs text-neutral-500">
            {preview.siteName ?? "Apple Music"}
          </p>
        </div>
      </PreviewLink>
    );
  }

  return (
    <PreviewLink
      className="mt-3 block overflow-hidden rounded-2xl border border-neutral-800 transition hover:border-neutral-700 hover:bg-neutral-950"
      preview={preview}
    >
      {preview.imageUrl ? (
        <LinkPreviewImage
          alt=""
          className="max-h-56 w-full object-cover"
          src={preview.imageUrl}
        />
      ) : null}
      <div className="space-y-1 p-3">
        {preview.siteName ? (
          <p className="text-xs text-neutral-500">{preview.siteName}</p>
        ) : null}
        {preview.title ? (
          <p className="line-clamp-2 text-sm font-semibold text-neutral-100">
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className="line-clamp-3 text-sm leading-5 text-neutral-400">
            {preview.description}
          </p>
        ) : null}
        <p className="truncate text-xs text-neutral-600">{domain}</p>
      </div>
    </PreviewLink>
  );
}
