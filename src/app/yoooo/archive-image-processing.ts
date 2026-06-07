"use client";

import {
  ARCHIVE_IMAGE_JPEG_QUALITY,
  ARCHIVE_IMAGE_MAX_DIMENSION,
  ARCHIVE_IMAGE_MAX_SIZE_BYTES,
  ARCHIVE_ORIGINAL_IMAGE_MAX_SIZE_BYTES,
  formatArchiveFileSize,
  getArchiveImageFileInfo,
  getArchiveImageUploadType,
} from "@/lib/archive";

export type PreparedArchiveImageFile = {
  file: File;
  originalFile: File;
  wasCompressed: boolean;
};

type DecodedImage = {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

function formatFileError(file: File, message: string) {
  return `${file.name}: ${message}`;
}

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function logArchiveFiles(context: string, stage: string, files: File[]) {
  if (!isDevelopment()) {
    return;
  }

  console.info(
    `[archive-upload:${context}] ${stage}`,
    files.map((file) => ({
      extension: getArchiveImageFileInfo(file).extension,
      name: file.name,
      size: file.size,
      type: file.type,
    }))
  );
}

function getSourceFileError(file: File) {
  if (!file || file.size === 0) {
    return "Selecciona una imagen valida.";
  }

  const uploadType = getArchiveImageUploadType(file);

  if (!uploadType.ok) {
    switch (uploadType.reason) {
      case "unsupported_heic":
        return "HEIC photos from iPhone are not supported yet. Please select Most Compatible/JPEG or convert them first.";
      case "unsupported_video":
        return "MOV/Live Photo videos no son compatibles. Selecciona solo fotos.";
      case "invalid_type":
        return "Usa imagenes JPG, PNG, WebP o GIF.";
    }

    return "Usa imagenes JPG, PNG, WebP o GIF.";
  }

  if (file.size > ARCHIVE_ORIGINAL_IMAGE_MAX_SIZE_BYTES) {
    return `pesa ${formatArchiveFileSize(
      file.size
    )}; el maximo antes de procesar es ${formatArchiveFileSize(
      ARCHIVE_ORIGINAL_IMAGE_MAX_SIZE_BYTES
    )}.`;
  }

  if (uploadType.extension === "gif" && file.size > ARCHIVE_IMAGE_MAX_SIZE_BYTES) {
    return `GIF pesa ${formatArchiveFileSize(
      file.size
    )}; debe pesar menos de ${formatArchiveFileSize(
      ARCHIVE_IMAGE_MAX_SIZE_BYTES
    )}.`;
  }

  return null;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);

      return {
        close: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
      };
    } catch {
      // Fall through to Image.decode(), which is more reliable in some Safari
      // versions for camera-roll JPEGs.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    image.decoding = "async";
    image.src = objectUrl;

    await image.decode();

    return {
      close: () => URL.revokeObjectURL(objectUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas did not produce an image."));
      },
      mimeType,
      quality
    );
  });
}

function compressedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "archive-image";

  return `${baseName}.jpg`;
}

async function compressImage(file: File) {
  const decoded = await decodeImage(file);

  try {
    const maxSourceSide = Math.max(decoded.width, decoded.height);
    const baseScale =
      maxSourceSide > ARCHIVE_IMAGE_MAX_DIMENSION
        ? ARCHIVE_IMAGE_MAX_DIMENSION / maxSourceSide
        : 1;
    const attempts = [
      { quality: ARCHIVE_IMAGE_JPEG_QUALITY, scale: baseScale },
      { quality: 0.78, scale: baseScale },
      { quality: 0.72, scale: baseScale * 0.85 },
      { quality: 0.66, scale: baseScale * 0.7 },
    ];

    for (const attempt of attempts) {
      const width = Math.max(1, Math.round(decoded.width * attempt.scale));
      const height = Math.max(1, Math.round(decoded.height * attempt.scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is not available.");
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, "image/jpeg", attempt.quality);

      if (blob.size <= ARCHIVE_IMAGE_MAX_SIZE_BYTES) {
        return new File([blob], compressedFileName(file.name), {
          lastModified: file.lastModified,
          type: "image/jpeg",
        });
      }
    }

    throw new Error("Compressed image is still too large.");
  } finally {
    decoded.close();
  }
}

async function prepareArchiveImageFile(file: File) {
  const sourceError = getSourceFileError(file);

  if (sourceError) {
    return {
      error: formatFileError(file, sourceError),
      prepared: null,
    };
  }

  const uploadType = getArchiveImageUploadType(file);

  if (!uploadType.ok) {
    return {
      error: formatFileError(file, "Usa imagenes JPG, PNG, WebP o GIF."),
      prepared: null,
    };
  }

  if (uploadType.extension === "gif" || file.size <= ARCHIVE_IMAGE_MAX_SIZE_BYTES) {
    return {
      error: null,
      prepared: {
        file,
        originalFile: file,
        wasCompressed: false,
      },
    };
  }

  try {
    const compressed = await compressImage(file);

    if (isDevelopment()) {
      console.info(`[archive-upload] compressed image`, {
        from: formatArchiveFileSize(file.size),
        name: file.name,
        to: formatArchiveFileSize(compressed.size),
      });
    }

    return {
      error: null,
      prepared: {
        file: compressed,
        originalFile: file,
        wasCompressed: true,
      },
    };
  } catch {
    return {
      error: formatFileError(
        file,
        `no se pudo comprimir debajo de ${formatArchiveFileSize(
          ARCHIVE_IMAGE_MAX_SIZE_BYTES
        )}.`
      ),
      prepared: null,
    };
  }
}

export async function prepareArchiveImageFiles(
  files: File[],
  context: string
) {
  logArchiveFiles(context, "selected", files);

  const results = await Promise.all(files.map(prepareArchiveImageFile));
  const errors = results
    .map((result) => result.error)
    .filter((message): message is string => Boolean(message));
  const preparedFiles = results
    .map((result) => result.prepared)
    .filter(
      (prepared): prepared is PreparedArchiveImageFile => prepared !== null
    );

  logArchiveFiles(
    context,
    "prepared",
    preparedFiles.map((prepared) => prepared.file)
  );

  return { errors, files: preparedFiles };
}
