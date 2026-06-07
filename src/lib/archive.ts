export const ARCHIVE_ALLOWED_IMAGE_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ARCHIVE_ALLOWED_IMAGE_EXTENSIONS = [
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
] as const;

export const ARCHIVE_HEIC_IMAGE_EXTENSIONS = ["heic", "heif"] as const;
export const ARCHIVE_HEIC_IMAGE_TYPES = ["image/heic", "image/heif"] as const;

export const ARCHIVE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const ARCHIVE_ORIGINAL_IMAGE_MAX_SIZE_BYTES = 30 * 1024 * 1024;
export const ARCHIVE_UPLOAD_TOTAL_MAX_SIZE_BYTES = 45 * 1024 * 1024;
export const ARCHIVE_IMAGE_MAX_DIMENSION = 2560;
export const ARCHIVE_IMAGE_JPEG_QUALITY = 0.86;
export const ARCHIVE_IMAGE_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

export const ARCHIVE_EXTENSION_TO_MIME_TYPE = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export const ARCHIVE_MIME_TYPE_TO_EXTENSION = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ArchiveAllowedImageMimeType =
  (typeof ARCHIVE_ALLOWED_IMAGE_TYPES)[number];
export type ArchiveAllowedImageExtension =
  (typeof ARCHIVE_ALLOWED_IMAGE_EXTENSIONS)[number];

export function formatArchiveFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getArchiveFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();

  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

function normalizeMimeType(mimeType: string) {
  const type = mimeType.trim().toLowerCase();

  if (type === "image/jpg" || type === "image/pjpeg") {
    return "image/jpeg";
  }

  return type;
}

export function getArchiveImageFileInfo(file: File) {
  const extension = getArchiveFileExtension(file.name);
  const mimeType = normalizeMimeType(file.type);

  return { extension, mimeType };
}

export function getArchiveImageUploadType(file: File) {
  const { extension, mimeType } = getArchiveImageFileInfo(file);

  if (
    ARCHIVE_HEIC_IMAGE_EXTENSIONS.includes(
      extension as (typeof ARCHIVE_HEIC_IMAGE_EXTENSIONS)[number]
    ) ||
    ARCHIVE_HEIC_IMAGE_TYPES.includes(
      mimeType as (typeof ARCHIVE_HEIC_IMAGE_TYPES)[number]
    )
  ) {
    return { ok: false as const, reason: "unsupported_heic" as const };
  }

  if (extension === "mov" || mimeType === "video/quicktime") {
    return { ok: false as const, reason: "unsupported_video" as const };
  }

  if (extension in ARCHIVE_EXTENSION_TO_MIME_TYPE) {
    const uploadExtension =
      extension === "jpeg" ? "jpg" : (extension as ArchiveAllowedImageExtension);

    return {
      ok: true as const,
      extension: uploadExtension,
      mimeType:
        ARCHIVE_EXTENSION_TO_MIME_TYPE[
          extension as keyof typeof ARCHIVE_EXTENSION_TO_MIME_TYPE
        ],
    };
  }

  if (mimeType in ARCHIVE_MIME_TYPE_TO_EXTENSION) {
    return {
      ok: true as const,
      extension:
        ARCHIVE_MIME_TYPE_TO_EXTENSION[
          mimeType as keyof typeof ARCHIVE_MIME_TYPE_TO_EXTENSION
        ],
      mimeType: mimeType as ArchiveAllowedImageMimeType,
    };
  }

  return { ok: false as const, reason: "invalid_type" as const };
}

export function parseArchiveTakenAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
