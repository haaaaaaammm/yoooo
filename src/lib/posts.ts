export const ADMIN_PATH = "/yoooo";
export const ARCHIVE_PATH = "/archive";
export const PUBLIC_FEED_PATH = "/nohaydiferenciasentreestoyunpoemario";
export const POST_CONTENT_MAX_LENGTH = 500;
export const POSTS_PER_PAGE = 50;
export const ARCHIVE_POSTS_PER_PAGE = 10;
export const ARCHIVE_ALBUM_PHOTOS_PER_PAGE = 36;

export function parsePageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
    return 1;
  }

  return Number(rawValue);
}
