export const ARCHIVO_ALLOWED_IMAGE_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ARCHIVO_ALLOWED_IMAGE_EXTENSIONS = [
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
] as const;

export const ARCHIVO_HEIC_IMAGE_EXTENSIONS = ["heic", "heif"] as const;
export const ARCHIVO_HEIC_IMAGE_TYPES = ["image/heic", "image/heif"] as const;

export const ARCHIVO_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const ARCHIVO_ORIGINAL_IMAGE_MAX_SIZE_BYTES = 30 * 1024 * 1024;
export const ARCHIVO_IMAGE_MAX_DIMENSION = 2560;
export const ARCHIVO_IMAGE_JPEG_QUALITY = 0.86;
export const ARCHIVO_IMAGE_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";
export const ARCHIVO_ALBUM_THRESHOLD = 20;
export const ARCHIVO_POST_KIND = "post";
export const ARCHIVO_ALBUM_KIND = "album";

export const ARCHIVO_EXTENSION_TO_MIME_TYPE = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export const ARCHIVO_MIME_TYPE_TO_EXTENSION = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ArchivoAllowedImageMimeType =
  (typeof ARCHIVO_ALLOWED_IMAGE_TYPES)[number];
export type ArchivoAllowedImageExtension =
  (typeof ARCHIVO_ALLOWED_IMAGE_EXTENSIONS)[number];

export function formatArchivoFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getArchivoFileExtension(fileName: string) {
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

export function getArchivoImageFileInfo(file: File) {
  const extension = getArchivoFileExtension(file.name);
  const mimeType = normalizeMimeType(file.type);

  return { extension, mimeType };
}

export function getArchivoImageUploadType(file: File) {
  const { extension, mimeType } = getArchivoImageFileInfo(file);

  if (
    ARCHIVO_HEIC_IMAGE_EXTENSIONS.includes(
      extension as (typeof ARCHIVO_HEIC_IMAGE_EXTENSIONS)[number]
    ) ||
    ARCHIVO_HEIC_IMAGE_TYPES.includes(
      mimeType as (typeof ARCHIVO_HEIC_IMAGE_TYPES)[number]
    )
  ) {
    return { ok: false as const, reason: "unsupported_heic" as const };
  }

  if (extension === "mov" || mimeType === "video/quicktime") {
    return { ok: false as const, reason: "unsupported_video" as const };
  }

  if (extension in ARCHIVO_EXTENSION_TO_MIME_TYPE) {
    const uploadExtension =
      extension === "jpeg" ? "jpg" : (extension as ArchivoAllowedImageExtension);

    return {
      ok: true as const,
      extension: uploadExtension,
      mimeType:
        ARCHIVO_EXTENSION_TO_MIME_TYPE[
          extension as keyof typeof ARCHIVO_EXTENSION_TO_MIME_TYPE
        ],
    };
  }

  if (mimeType in ARCHIVO_MIME_TYPE_TO_EXTENSION) {
    return {
      ok: true as const,
      extension:
        ARCHIVO_MIME_TYPE_TO_EXTENSION[
          mimeType as keyof typeof ARCHIVO_MIME_TYPE_TO_EXTENSION
        ],
      mimeType: mimeType as ArchivoAllowedImageMimeType,
    };
  }

  return { ok: false as const, reason: "invalid_type" as const };
}

export function parseArchivoTakenAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
