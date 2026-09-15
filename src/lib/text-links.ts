import { SITE_ORIGIN } from "./site-url";

export type LinkifiedTextPart =
  | {
      text: string;
      type: "text";
    }
  | {
      href: string;
      text: string;
      type: "link";
    };

const INTERNAL_ROUTE_PATTERN =
  "(?:otrogato|diferencias|nohaydiferenciasentreestoyunpoemario|archivo|archive)";
const URL_PATTERN = new RegExp(
  `\\b(?:https?:\\/\\/|www\\.)[^\\s<>"']+|\\/${INTERNAL_ROUTE_PATTERN}(?:\\/[^\\s<>"']*)?`,
  "gi"
);
const TRAILING_PUNCTUATION = new Set([".", ",", ")", "]", "!", "?"]);

function splitTrailingPunctuation(value: string) {
  let text = value;
  let trailing = "";

  while (text && TRAILING_PUNCTUATION.has(text[text.length - 1])) {
    trailing = `${text[text.length - 1]}${trailing}`;
    text = text.slice(0, -1);
  }

  return { text, trailing };
}

function toHref(value: string) {
  if (value.startsWith("/")) {
    return value;
  }

  return value.toLowerCase().startsWith("www.") ? `https://${value}` : value;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value, SITE_ORIGIN);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getLinkifiedTextParts(text: string): LinkifiedTextPart[] {
  const parts: LinkifiedTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    const { text: linkText, trailing } = splitTrailingPunctuation(rawMatch);
    const href = toHref(linkText);

    if (!linkText || !isSafeHttpUrl(href)) {
      continue;
    }

    if (matchIndex > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, matchIndex),
        type: "text",
      });
    }

    parts.push({
      href,
      text: linkText,
      type: "link",
    });

    if (trailing) {
      parts.push({
        text: trailing,
        type: "text",
      });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      type: "text",
    });
  }

  return parts.length > 0 ? parts : [{ text, type: "text" }];
}

export function getFirstPreviewUrl(text: string) {
  const part = getLinkifiedTextParts(text).find(
    (candidate) => candidate.type === "link"
  );

  if (!part || part.type !== "link") {
    return null;
  }

  return new URL(part.href, SITE_ORIGIN).toString();
}

export function hasLinkifiedText(text: string) {
  return getLinkifiedTextParts(text).some((part) => part.type === "link");
}
