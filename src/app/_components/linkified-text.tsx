import Link from "next/link";

import { getLinkifiedTextParts } from "@/lib/text-links";
import { isOwnSiteUrl, SITE_ORIGIN } from "@/lib/site-url";

export { getLinkifiedTextParts, hasLinkifiedText } from "@/lib/text-links";

export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {getLinkifiedTextParts(text).map((part, index) => {
        if (part.type !== "link") {
          return <span key={`${index}-${part.text}`}>{part.text}</span>;
        }

        const className =
          "break-words [overflow-wrap:anywhere] text-[#ff003c] no-underline transition hover:text-[#ff4d75]";
        const url = new URL(part.href, SITE_ORIGIN);

        return isOwnSiteUrl(url) ? (
          <Link
            className={className}
            href={`${url.pathname}${url.search}${url.hash}`}
            key={`${part.href}-${index}`}
          >
            {part.text}
          </Link>
        ) : (
          <a
            className={className}
            href={part.href}
            key={`${part.href}-${index}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part.text}
          </a>
        );
      })}
    </>
  );
}
