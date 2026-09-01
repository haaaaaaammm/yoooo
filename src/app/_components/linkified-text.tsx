type LinkifiedTextPart =
  | {
      text: string;
      type: "text";
    }
  | {
      href: string;
      text: string;
      type: "link";
    };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
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
  return value.toLowerCase().startsWith("www.") ? `https://${value}` : value;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);

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

export function hasLinkifiedText(text: string) {
  return getLinkifiedTextParts(text).some((part) => part.type === "link");
}

export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {getLinkifiedTextParts(text).map((part, index) =>
        part.type === "link" ? (
          <a
            className="break-words [overflow-wrap:anywhere] text-[#ff003c] no-underline transition hover:text-[#ff4d75]"
            href={part.href}
            key={`${part.href}-${index}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part.text}
          </a>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        )
      )}
    </>
  );
}
