"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

import {
  ARCHIVE_IMAGE_MAX_SIZE_BYTES,
  ARCHIVE_UPLOAD_TOTAL_MAX_SIZE_BYTES,
  formatArchiveFileSize,
  getArchiveImageFileInfo,
  parseArchiveTakenAt,
} from "@/lib/archive";
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from "@/lib/auth";
import { ADMIN_PATH, ARCHIVE_PATH, PUBLIC_FEED_PATH } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";
import {
  deleteR2Object,
  uploadArchiveImageToR2,
  uploadProfileImageToR2,
  validateImageFile,
  validateProfileImageFile,
} from "@/lib/r2";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginAdmin(username, password);

  if (!result.ok) {
    redirect(`${ADMIN_PATH}?error=${result.reason}`);
  }

  redirect(ADMIN_PATH);
}

export async function logoutAction() {
  await logoutAdmin();
  revalidatePath(ADMIN_PATH);
  redirect(ADMIN_PATH);
}

export async function createPostAction(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    redirect(`${ADMIN_PATH}?error=auth`);
  }

  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    redirect(`${ADMIN_PATH}?error=empty`);
  }

  await getPrisma().post.create({
    data: { content },
  });

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?published=1`);
}

export async function deletePostAction(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    redirect(`${ADMIN_PATH}?error=auth`);
  }

  const postId = String(formData.get("postId") ?? "");

  if (!postId) {
    redirect(`${ADMIN_PATH}?error=delete`);
  }

  const prisma = getPrisma();
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    redirect(`${ADMIN_PATH}?error=not_found`);
  }

  await prisma.post.delete({
    where: { id: postId },
  });

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?deleted=1`);
}

type UpdatePostResult =
  | { ok: true; content: string }
  | { ok: false; reason: "auth" | "empty" | "not_found" | "update" };

export async function updatePostAction(
  postId: string,
  rawContent: string
): Promise<UpdatePostResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, reason: "auth" };
  }

  const content = rawContent.trim();

  if (!postId) {
    return { ok: false, reason: "not_found" };
  }

  if (!content) {
    return { ok: false, reason: "empty" };
  }

  const prisma = getPrisma();
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    return { ok: false, reason: "not_found" };
  }

  try {
    await prisma.post.update({
      where: { id: postId },
      data: { content },
    });
  } catch {
    return { ok: false, reason: "update" };
  }

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);

  return { ok: true, content };
}

type UpdateProfileImageState = {
  ok: boolean;
  message: string | null;
};

function profileImageErrorMessage(
  reason:
    | "missing"
    | "too_large"
    | "invalid_type"
    | "unsupported_heic"
    | "unsupported_video"
) {
  switch (reason) {
    case "missing":
      return "Selecciona una imagen.";
    case "too_large":
      return "La imagen debe pesar menos de 5 MB.";
    case "unsupported_heic":
      return "HEIC photos from iPhone are not supported yet. Please select Most Compatible/JPEG or convert them first.";
    case "unsupported_video":
      return "MOV/Live Photo videos no son compatibles. Selecciona solo fotos.";
    case "invalid_type":
      return "Usa una imagen JPG, PNG, WebP o GIF.";
  }
}

export async function updateProfileImageAction(
  _state: UpdateProfileImageState,
  formData: FormData
): Promise<UpdateProfileImageState> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const file = formData.get("profileImage");

  if (!(file instanceof File)) {
    return { ok: false, message: "Selecciona una imagen." };
  }

  const validation = validateProfileImageFile(file);

  if (!validation.ok) {
    return { ok: false, message: profileImageErrorMessage(validation.reason) };
  }

  const prisma = getPrisma();
  const previousSettings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
    select: { profileImageKey: true },
  });

  let uploadedImage: Awaited<ReturnType<typeof uploadProfileImageToR2>>;

  try {
    uploadedImage = await uploadProfileImageToR2(file);
  } catch {
    return { ok: false, message: "No se pudo subir la imagen." };
  }

  try {
    await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: {
        id: SITE_SETTINGS_ID,
        profileImageKey: uploadedImage.key,
        profileImageUrl: uploadedImage.url,
      },
      update: {
        profileImageKey: uploadedImage.key,
        profileImageUrl: uploadedImage.url,
      },
    });
  } catch {
    return { ok: false, message: "No se pudo guardar la foto." };
  }

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);

  if (previousSettings?.profileImageKey) {
    try {
      await deleteR2Object(previousSettings.profileImageKey);
    } catch {
      // The new image is already active; old cleanup should not block it.
    }
  }

  return { ok: true, message: "foto actualizada" };
}

type CreateArchivePostState = {
  ok: boolean;
  message: string | null;
  postId?: string;
};

type ArchiveImageResult = {
  id: string;
  key: string;
  order: number;
  url: string;
};

type ArchiveMutationResult =
  | {
      ok: true;
      description?: string;
      images?: ArchiveImageResult[];
      takenAt?: string;
    }
  | { ok: false; message: string };

function imageErrorMessage(
  reason:
    | "missing"
    | "too_large"
    | "invalid_type"
    | "unsupported_heic"
    | "unsupported_video",
  fileName?: string
) {
  const prefix = fileName ? `${fileName}: ` : "";

  switch (reason) {
    case "missing":
      return "Selecciona al menos una imagen.";
    case "too_large":
      return `${prefix}La imagen procesada debe pesar menos de ${formatArchiveFileSize(
        ARCHIVE_IMAGE_MAX_SIZE_BYTES
      )}.`;
    case "unsupported_heic":
      return `${prefix}HEIC photos from iPhone are not supported yet. Please select Most Compatible/JPEG or convert them first.`;
    case "unsupported_video":
      return `${prefix}MOV/Live Photo videos no son compatibles. Selecciona solo fotos.`;
    case "invalid_type":
      return `${prefix}Usa imagenes JPG, PNG, WebP o GIF.`;
  }
}

function getArchiveUploadTotalSize(images: File[]) {
  return images.reduce((total, image) => total + image.size, 0);
}

function getArchiveImageValidationMessages(images: File[]) {
  const messages: string[] = [];

  for (const image of images) {
    const validation = validateImageFile(image);

    if (!validation.ok) {
      messages.push(imageErrorMessage(validation.reason, image.name));
    }
  }

  const totalSize = getArchiveUploadTotalSize(images);

  if (totalSize > ARCHIVE_UPLOAD_TOTAL_MAX_SIZE_BYTES) {
    messages.push(
      `El lote pesa ${formatArchiveFileSize(
        totalSize
      )}; debe quedar abajo de ${formatArchiveFileSize(
        ARCHIVE_UPLOAD_TOTAL_MAX_SIZE_BYTES
      )}. Sube menos peso en una tanda.`
    );
  }

  return messages;
}

function logArchiveUploadDebug(context: string, images: File[]) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(
    `[archive-upload:${context}] files=${images.length} total=${formatArchiveFileSize(
      getArchiveUploadTotalSize(images)
    )}`,
    images.map((image) => ({
      extension: getArchiveImageFileInfo(image).extension,
      name: image.name,
      size: image.size,
      type: image.type,
    }))
  );
}

async function cleanupUploadedImages(keys: string[]) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteR2Object(key);
      } catch {
        // A failed cleanup should not hide the original upload/save error.
      }
    })
  );
}

function serializeArchiveImage(image: {
  id: string;
  key: string;
  order: number;
  url: string;
}): ArchiveImageResult {
  return {
    id: image.id,
    key: image.key,
    order: image.order,
    url: image.url,
  };
}

async function getOrderedArchiveImages(postId: string) {
  const images = await getPrisma().archiveImage.findMany({
    orderBy: { order: "asc" },
    where: { postId },
  });

  return images.map(serializeArchiveImage);
}

function revalidateArchiveAdmin() {
  revalidatePath(ARCHIVE_PATH);
  revalidatePath(ADMIN_PATH);
}

export async function createArchivePostAction(
  _state: CreateArchivePostState,
  formData: FormData
): Promise<CreateArchivePostState> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const description = String(formData.get("description") ?? "").trim();
  const takenAt = parseArchiveTakenAt(String(formData.get("takenAt") ?? ""));
  const images = formData
    .getAll("images")
    .filter((image): image is File => image instanceof File && image.size > 0);

  if (!takenAt) {
    return { ok: false, message: "Elige una fecha valida." };
  }

  if (images.length === 0) {
    return { ok: false, message: "Selecciona al menos una imagen." };
  }

  logArchiveUploadDebug("create-formdata", images);

  const validationMessages = getArchiveImageValidationMessages(images);

  if (validationMessages.length > 0) {
    return {
      ok: false,
      message: validationMessages.join("\n"),
    };
  }

  const postId = randomUUID();
  const uploadedImages: { key: string; url: string }[] = [];

  try {
    for (const [index, image] of images.entries()) {
      if (process.env.NODE_ENV === "development") {
        console.info(
          `[archive-upload:create] uploading ${index + 1}/${images.length}`,
          {
            name: image.name,
            size: image.size,
            type: image.type,
          }
        );
      }

      uploadedImages.push(await uploadArchiveImageToR2(image, postId, index));
    }
  } catch {
    await cleanupUploadedImages(uploadedImages.map((image) => image.key));
    return { ok: false, message: "No se pudieron subir las imagenes." };
  }

  try {
    await getPrisma().archivePost.create({
      data: {
        id: postId,
        description,
        takenAt,
        images: {
          create: uploadedImages.map((image, index) => ({
            key: image.key,
            order: index,
            url: image.url,
          })),
        },
      },
    });
  } catch {
    await cleanupUploadedImages(uploadedImages.map((image) => image.key));
    return { ok: false, message: "No se pudo guardar el archivo." };
  }

  revalidateArchiveAdmin();

  return { ok: true, message: "guardado en archive", postId };
}

export async function updateArchivePostAction(
  postId: string,
  rawDescription: string,
  rawTakenAt: string
): Promise<ArchiveMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const description = rawDescription.trim();
  const takenAt = parseArchiveTakenAt(rawTakenAt);

  if (!takenAt) {
    return { ok: false, message: "Elige una fecha valida." };
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    select: { id: true },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  try {
    const updatedPost = await prisma.archivePost.update({
      data: { description, takenAt },
      select: { description: true, takenAt: true },
      where: { id: postId },
    });

    revalidateArchiveAdmin();

    return {
      ok: true,
      description: updatedPost.description,
      takenAt: updatedPost.takenAt.toISOString(),
    };
  } catch {
    return { ok: false, message: "No se pudo guardar el archivo." };
  }
}

export async function addArchiveImagesAction(
  postId: string,
  formData: FormData
): Promise<ArchiveMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    include: { images: { orderBy: { order: "asc" } } },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  const images = formData
    .getAll("images")
    .filter((image): image is File => image instanceof File && image.size > 0);

  if (images.length === 0) {
    return { ok: false, message: "Selecciona al menos una imagen." };
  }

  logArchiveUploadDebug("add-formdata", images);

  const validationMessages = getArchiveImageValidationMessages(images);

  if (validationMessages.length > 0) {
    return {
      ok: false,
      message: validationMessages.join("\n"),
    };
  }

  const nextOrder =
    post.images.length > 0
      ? Math.max(...post.images.map((image) => image.order)) + 1
      : 0;
  const uploadedImages: { key: string; url: string }[] = [];

  try {
    for (const [index, image] of images.entries()) {
      if (process.env.NODE_ENV === "development") {
        console.info(
          `[archive-upload:add] uploading ${index + 1}/${images.length}`,
          {
            name: image.name,
            size: image.size,
            type: image.type,
          }
        );
      }

      uploadedImages.push(
        await uploadArchiveImageToR2(image, postId, nextOrder + index)
      );
    }
  } catch {
    await cleanupUploadedImages(uploadedImages.map((image) => image.key));
    return { ok: false, message: "No se pudieron subir las imagenes." };
  }

  try {
    await prisma.archiveImage.createMany({
      data: uploadedImages.map((image, index) => ({
        key: image.key,
        order: nextOrder + index,
        postId,
        url: image.url,
      })),
    });
  } catch {
    await cleanupUploadedImages(uploadedImages.map((image) => image.key));
    return { ok: false, message: "No se pudieron guardar las imagenes." };
  }

  revalidateArchiveAdmin();

  return {
    ok: true,
    images: await getOrderedArchiveImages(postId),
  };
}

export async function removeArchiveImageAction(
  imageId: string
): Promise<ArchiveMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const prisma = getPrisma();
  const image = await prisma.archiveImage.findUnique({
    include: {
      post: {
        include: {
          images: { orderBy: { order: "asc" } },
        },
      },
    },
    where: { id: imageId },
  });

  if (!image) {
    return { ok: false, message: "Esa imagen ya no existe." };
  }

  if (image.post.images.length <= 1) {
    return {
      ok: false,
      message: "No puedes dejar un archivo sin imagenes. Borra el archivo completo.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.archiveImage.delete({ where: { id: imageId } });

      const remainingImages = image.post.images.filter(
        (postImage) => postImage.id !== imageId
      );

      await Promise.all(
        remainingImages.map((remainingImage, index) =>
          transaction.archiveImage.update({
            data: { order: index },
            where: { id: remainingImage.id },
          })
        )
      );
    });
  } catch {
    return { ok: false, message: "No se pudo quitar la imagen." };
  }

  try {
    await deleteR2Object(image.key);
  } catch {
    // The database already reflects the removal; R2 cleanup can be retried later.
  }

  revalidateArchiveAdmin();

  return {
    ok: true,
    images: await getOrderedArchiveImages(image.postId),
  };
}

export async function reorderArchiveImagesAction(
  postId: string,
  imageIds: string[]
): Promise<ArchiveMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const uniqueImageIds = [...new Set(imageIds)];

  if (uniqueImageIds.length !== imageIds.length) {
    return { ok: false, message: "Orden invalido." };
  }

  const prisma = getPrisma();
  const images = await prisma.archiveImage.findMany({
    where: { postId },
  });
  const existingIds = new Set(images.map((image) => image.id));

  if (
    imageIds.length !== images.length ||
    imageIds.some((imageId) => !existingIds.has(imageId))
  ) {
    return { ok: false, message: "Orden invalido." };
  }

  try {
    await prisma.$transaction(
      imageIds.map((imageId, index) =>
        prisma.archiveImage.update({
          data: { order: index },
          where: { id: imageId },
        })
      )
    );
  } catch {
    return { ok: false, message: "No se pudo reordenar." };
  }

  revalidateArchiveAdmin();

  return {
    ok: true,
    images: await getOrderedArchiveImages(postId),
  };
}

export async function deleteArchivePostAction(
  postId: string
): Promise<ArchiveMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    include: { images: true },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  try {
    await prisma.archivePost.delete({ where: { id: postId } });
  } catch {
    return { ok: false, message: "No se pudo borrar el archivo." };
  }

  await cleanupUploadedImages(post.images.map((image) => image.key));
  revalidateArchiveAdmin();

  return { ok: true };
}
