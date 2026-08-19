import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

import {
  ARCHIVO_ALBUM_KIND,
  ARCHIVO_IMAGE_MAX_SIZE_BYTES,
  ARCHIVO_MIME_TYPE_TO_EXTENSION,
  ARCHIVO_POST_KIND,
  getArchivoImageUploadType,
} from "@/lib/archivo";

export const IMAGE_MAX_SIZE_BYTES = ARCHIVO_IMAGE_MAX_SIZE_BYTES;
export const PROFILE_IMAGE_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_BYTES;

export const IMAGE_FILE_EXTENSIONS = ARCHIVO_MIME_TYPE_TO_EXTENSION;
export const PROFILE_IMAGE_EXTENSIONS = IMAGE_FILE_EXTENSIONS;

type ImageMimeType = keyof typeof IMAGE_FILE_EXTENSIONS;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

let s3Client: S3Client | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Cloudflare R2 uploads.`);
  }

  return value;
}

function getR2Config(): R2Config {
  return {
    accountId: requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("CLOUDFLARE_R2_BUCKET_NAME"),
    publicUrl: requiredEnv("CLOUDFLARE_R2_PUBLIC_URL").replace(/\/+$/, ""),
  };
}

function getS3Client(config: R2Config) {
  if (!s3Client) {
    s3Client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: "auto",
    });
  }

  return s3Client;
}

export function validateProfileImageFile(file: File) {
  const validation = validateImageFile(file);

  if (!validation.ok) {
    return validation;
  }

  const normalizedMimeType = file.type.trim().toLowerCase();
  const canonicalMimeType =
    normalizedMimeType === "image/jpg" ||
    normalizedMimeType === "image/pjpeg"
      ? "image/jpeg"
      : normalizedMimeType;

  if (
    !Object.hasOwn(IMAGE_FILE_EXTENSIONS, canonicalMimeType) ||
    validation.mimeType !== canonicalMimeType
  ) {
    return { ok: false as const, reason: "invalid_type" as const };
  }

  return validation;
}

export function validateImageFile(file: File) {
  if (!file || file.size === 0) {
    return { ok: false as const, reason: "missing" as const };
  }

  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return { ok: false as const, reason: "too_large" as const };
  }

  const uploadType = getArchivoImageUploadType(file);

  if (!uploadType.ok) {
    return uploadType;
  }

  return {
    ok: true as const,
    extension: uploadType.extension,
    mimeType: uploadType.mimeType as ImageMimeType,
  };
}

async function uploadProfileStyleImageToR2(file: File, keyBase: string) {
  const validation = validateProfileImageFile(file);

  if (!validation.ok) {
    throw new Error(`Invalid profile image: ${validation.reason}`);
  }

  const config = getR2Config();
  const key = `${keyBase}-${Date.now()}-${randomUUID()}.${validation.extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getS3Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      ContentType: validation.mimeType,
      Key: key,
    })
  );

  return {
    key,
    url: `${config.publicUrl}/${key}`,
  };
}

export async function uploadProfileImageToR2(file: File) {
  return uploadProfileStyleImageToR2(file, "profile/pfp");
}

export async function uploadPoemarioAvatarToR2(file: File) {
  return uploadProfileStyleImageToR2(file, "poemario/avatars/avatar");
}

export async function uploadDiferenciasAvatarToR2(file: File) {
  return uploadProfileStyleImageToR2(file, "diferencias/avatars/avatar");
}

export async function uploadArchivoImageToR2(
  file: File,
  postId: string,
  order?: number,
  kind: string = ARCHIVO_POST_KIND
) {
  const validation = validateImageFile(file);

  if (!validation.ok) {
    throw new Error(`Imagen de archivo invalida: ${validation.reason}`);
  }

  const config = getR2Config();
  const normalizedOrder = typeof order === "number" ? Math.max(0, order) : 0;
  const keyPrefix =
    kind === ARCHIVO_ALBUM_KIND ? "archivo/albums" : "archivo/posts";
  const key = `${keyPrefix}/${postId}/${Date.now()}-${randomUUID()}-${normalizedOrder}.${validation.extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getS3Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      ContentType: validation.mimeType,
      Key: key,
    })
  );

  return {
    key,
    url: `${config.publicUrl}/${key}`,
  };
}

export async function deleteR2Object(key: string) {
  const config = getR2Config();

  await getS3Client(config).send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}
