export const ADMIN_PATH = "/yoooo";
export const ARCHIVO_PATH = "/archivo";
export const PUBLIC_FEED_PATH = "/nohaydiferenciasentreestoyunpoemario";
export const DIFERENCIAS_PATH = "/diferencias";
export const OTROGATO_PATH = "/otrogato";
export const POST_CONTENT_MAX_LENGTH = 500;
export const POSTS_PER_PAGE = 50;
export const ARCHIVO_POSTS_PER_PAGE = 10;
export const ARCHIVO_ALBUM_PHOTOS_PER_PAGE = 36;
export const DIFERENCIAS_CONTENT_MAX_LENGTH = 20_000;
export const DIFERENCIAS_COMMENT_MAX_LENGTH = 10_000;

export function parsePageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
    return 1;
  }

  return Number(rawValue);
}
