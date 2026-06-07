export const ARCHIVE_ALLOWED_IMAGE_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ARCHIVE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function parseArchiveTakenAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
