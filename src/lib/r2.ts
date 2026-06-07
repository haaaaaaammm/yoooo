import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_BYTES;

export const IMAGE_FILE_EXTENSIONS = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
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
  return validateImageFile(file);
}

export function validateImageFile(file: File) {
  if (!file || file.size === 0) {
    return { ok: false as const, reason: "missing" as const };
  }

  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return { ok: false as const, reason: "too_large" as const };
  }

  if (!(file.type in IMAGE_FILE_EXTENSIONS)) {
    return { ok: false as const, reason: "invalid_type" as const };
  }

  return {
    ok: true as const,
    extension: IMAGE_FILE_EXTENSIONS[file.type as ImageMimeType],
    mimeType: file.type as ImageMimeType,
  };
}

export async function uploadProfileImageToR2(file: File) {
  const validation = validateProfileImageFile(file);

  if (!validation.ok) {
    throw new Error(`Invalid profile image: ${validation.reason}`);
  }

  const config = getR2Config();
  const key = `profile/pfp-${Date.now()}-${randomUUID()}.${validation.extension}`;
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

export async function uploadArchiveImageToR2(file: File, postId: string) {
  const validation = validateImageFile(file);

  if (!validation.ok) {
    throw new Error(`Invalid archive image: ${validation.reason}`);
  }

  const config = getR2Config();
  const key = `archive/posts/${postId}/${Date.now()}-${randomUUID()}.${validation.extension}`;
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
