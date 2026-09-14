import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { getCommentCountLabel } from "@/lib/comment-count";

export default function CommentCount({
  count,
  href,
}: {
  count: number;
  href?: string;
}) {
  const label = getCommentCountLabel(count);
  const className = href
    ? "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-sm leading-5 text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c]"
    : "inline-flex min-h-8 items-center gap-1.5 px-2 text-sm leading-5 text-neutral-500";
  const content = (
    <>
      <MessageCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      <span aria-hidden="true">{count}</span>
    </>
  );

  return href ? (
    <Link aria-label={label} className={className} href={href}>
      {content}
    </Link>
  ) : (
    <span aria-label={label} className={className}>
      {content}
    </span>
  );
}
