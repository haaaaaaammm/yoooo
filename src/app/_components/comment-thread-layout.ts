export const COMMENT_THREAD_MAX_MOBILE_VISUAL_DEPTH = 2;
export const COMMENT_THREAD_MAX_DESKTOP_VISUAL_DEPTH = 4;

const NODE_BASE_CLASSES = "min-w-0 max-w-full";
const MOBILE_AND_DESKTOP_INDENT_CLASSES =
  "border-l border-neutral-800 pl-3";
const DESKTOP_ONLY_INDENT_CLASSES =
  "sm:border-l sm:border-neutral-800 sm:pl-3";

export function getCommentThreadNodeClassName(depth: number) {
  if (depth <= 0) {
    return NODE_BASE_CLASSES;
  }

  if (depth <= COMMENT_THREAD_MAX_MOBILE_VISUAL_DEPTH) {
    return `${NODE_BASE_CLASSES} ${MOBILE_AND_DESKTOP_INDENT_CLASSES}`;
  }

  if (depth <= COMMENT_THREAD_MAX_DESKTOP_VISUAL_DEPTH) {
    return `${NODE_BASE_CLASSES} ${DESKTOP_ONLY_INDENT_CLASSES}`;
  }

  return NODE_BASE_CLASSES;
}
