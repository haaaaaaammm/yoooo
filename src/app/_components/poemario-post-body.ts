const POST_BODY_CLASS_NAME =
  "mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100";

export function getPoemarioPostBodyClassName(blink: boolean | undefined) {
  return `${POST_BODY_CLASS_NAME}${blink ? " poemario-blink" : ""}`;
}
