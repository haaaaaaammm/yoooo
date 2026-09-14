export const ADMIN_PATH = "/yoooo";
export const ARCHIVO_PATH = "/archivo";
export const PUBLIC_FEED_PATH = "/nohaydiferenciasentreestoyunpoemario";
export const OTROGATO_PATH = "/otrogato";
export const POST_CONTENT_MAX_LENGTH = 500;
export const POSTS_PER_PAGE = 50;
export const ARCHIVO_POSTS_PER_PAGE = 10;
export const ARCHIVO_ALBUM_PHOTOS_PER_PAGE = 36;
export const DIFERENCIAS_CONTENT_MAX_LENGTH = 20_000;
export const DIFERENCIAS_COMMENT_MAX_LENGTH = 10_000;
const MAX_REASONABLE_PAGE = 1_000_000;

export function parsePageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
    return 1;
  }

  const page = Number(rawValue);

  return Number.isSafeInteger(page) && page <= MAX_REASONABLE_PAGE ? page : 1;
}

export function getSafeOtrogatoPath(
  value: string | string[] | null | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (
    !rawValue ||
    !rawValue.startsWith("/") ||
    rawValue.startsWith("//") ||
    rawValue.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(rawValue)
  ) {
    return null;
  }

  try {
    const url = new URL(rawValue, "https://otrogato.invalid");

    if (
      url.origin !== "https://otrogato.invalid" ||
      (url.pathname !== OTROGATO_PATH &&
        !url.pathname.startsWith(`${OTROGATO_PATH}/`))
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function getOtrogatoLoginPath(destination: string) {
  const safeDestination = getSafeOtrogatoPath(destination);

  return safeDestination && safeDestination !== OTROGATO_PATH
    ? `${OTROGATO_PATH}?next=${encodeURIComponent(safeDestination)}`
    : OTROGATO_PATH;
}
