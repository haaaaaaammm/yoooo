"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

import {
  ARCHIVO_ALBUM_KIND,
  ARCHIVO_IMAGE_MAX_SIZE_BYTES,
  ARCHIVO_POST_KIND,
  formatArchivoFileSize,
  getArchivoImageFileInfo,
  parseArchivoTakenAt,
} from "@/lib/archivo";
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from "@/lib/auth";
import { ADMIN_PATH, ARCHIVO_PATH, PUBLIC_FEED_PATH } from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";
import {
  deleteR2Object,
  uploadArchivoImageToR2,
  uploadPoemarioAvatarToR2,
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

export type WalterBazarPostActionResult =
  | {
      avatar: { key: string; url: string };
      message: string;
      ok: true;
    }
  | { message: string; ok: false };

export async function createWalterBazarPostAction(
  formData: FormData
): Promise<WalterBazarPostActionResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const customAuthorName = String(
    formData.get("customAuthorName") ?? ""
  ).trim();
  const content = String(formData.get("content") ?? "").trim();
  const avatar = formData.get("customAuthorAvatar");
  const reusableAvatarKey = String(
    formData.get("customAuthorAvatarKey") ?? ""
  ).trim();

  if (!customAuthorName) {
    return { ok: false, message: "Escribe el nombre de la persona." };
  }

  if (!content) {
    return { ok: false, message: "Escribe algo antes de publicar." };
  }

  const prisma = getPrisma();
  let avatarReference: { key: string; url: string } | null = null;
  let newlyUploadedAvatarKey: string | null = null;

  if (reusableAvatarKey) {
    try {
      const existingAvatar = await prisma.post.findFirst({
        where: { customAuthorAvatarKey: reusableAvatarKey },
        select: {
          customAuthorAvatarKey: true,
          customAuthorAvatarUrl: true,
        },
      });

      if (
        existingAvatar?.customAuthorAvatarKey &&
        existingAvatar.customAuthorAvatarUrl
      ) {
        avatarReference = {
          key: existingAvatar.customAuthorAvatarKey,
          url: existingAvatar.customAuthorAvatarUrl,
        };
      }
    } catch {
      return { ok: false, message: "No se pudo validar la foto de perfil." };
    }
  }

  if (!avatarReference) {
    if (!(avatar instanceof File)) {
      return { ok: false, message: "Selecciona una foto de perfil." };
    }

    const avatarValidation = validateProfileImageFile(avatar);

    if (!avatarValidation.ok) {
      return {
        ok: false,
        message: profileImageErrorMessage(avatarValidation.reason),
      };
    }

    try {
      avatarReference = await uploadPoemarioAvatarToR2(avatar);
      newlyUploadedAvatarKey = avatarReference.key;
    } catch {
      return { ok: false, message: "No se pudo subir la foto de perfil." };
    }
  }

  try {
    await prisma.post.create({
      data: {
        content,
        customAuthorAvatarKey: avatarReference.key,
        customAuthorAvatarUrl: avatarReference.url,
        customAuthorName,
      },
    });
  } catch {
    if (newlyUploadedAvatarKey) {
      try {
        await deleteR2Object(newlyUploadedAvatarKey);
      } catch {
        // Best-effort cleanup; never mask the database error.
      }
    }

    return { ok: false, message: "No se pudo guardar el post." };
  }

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);

  return { avatar: avatarReference, ok: true, message: "posteado" };
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
    select: { customAuthorAvatarKey: true, id: true },
  });

  if (!post) {
    redirect(`${ADMIN_PATH}?error=not_found`);
  }

  await prisma.post.delete({
    where: { id: postId },
  });

  if (post.customAuthorAvatarKey) {
    let remainingAvatarReference = true;

    try {
      remainingAvatarReference = Boolean(
        await prisma.post.findFirst({
          where: { customAuthorAvatarKey: post.customAuthorAvatarKey },
          select: { id: true },
        })
      );
    } catch {
      // If reference lookup fails, preserve the object rather than break a post.
    }

    if (!remainingAvatarReference) {
      try {
        await deleteR2Object(post.customAuthorAvatarKey);
      } catch {
        // The post is already deleted; stale R2 cleanup must not block the UI.
      }
    }
  }

  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?deleted=1`);
}

type UpdatePostResult =
  | { ok: true; content: string }
  | { ok: false; reason: "auth" | "empty" | "not_found" | "update" };

type PoemarioCommentMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidatePoemarioCommentPath(postId: string, commentId: string) {
  revalidatePath(`${ADMIN_PATH}/poemario/${postId}/comment/${commentId}`);
  revalidatePath(`${PUBLIC_FEED_PATH}/${postId}/comment/${commentId}`);
}

function revalidatePoemarioThread(postId: string, commentId?: string | null) {
  revalidatePath(ADMIN_PATH);
  revalidatePath(PUBLIC_FEED_PATH);
  revalidatePath(`${ADMIN_PATH}/poemario/${postId}`);
  revalidatePath(`${PUBLIC_FEED_PATH}/${postId}`);

  if (commentId) {
    revalidatePoemarioCommentPath(postId, commentId);
  }
}

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

export async function createPoemarioCommentAction(
  postId: string,
  parentId: string | null,
  rawText: string
): Promise<PoemarioCommentMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const text = rawText.trim();

  if (!text) {
    return { ok: false, message: "Escribe algo antes de comentar." };
  }

  const prisma = getPrisma();
  const post = await prisma.post.findUnique({
    select: { id: true },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese post ya no existe." };
  }

  if (parentId) {
    const parent = await prisma.poemarioComment.findUnique({
      select: { postId: true },
      where: { id: parentId },
    });

    if (!parent || parent.postId !== postId) {
      return { ok: false, message: "Ese comentario ya no existe." };
    }
  }

  try {
    await prisma.poemarioComment.create({
      data: {
        parentId,
        postId,
        text,
      },
    });
  } catch {
    return { ok: false, message: "No se pudo guardar el comentario." };
  }

  revalidatePoemarioThread(postId, parentId);

  return { ok: true, message: "comentario guardado" };
}

export async function updatePoemarioCommentAction(
  commentId: string,
  rawText: string
): Promise<PoemarioCommentMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const text = rawText.trim();

  if (!text) {
    return { ok: false, message: "Escribe algo antes de guardar." };
  }

  const prisma = getPrisma();
  const comment = await prisma.poemarioComment.findUnique({
    select: { postId: true },
    where: { id: commentId },
  });

  if (!comment) {
    return { ok: false, message: "Ese comentario ya no existe." };
  }

  try {
    await prisma.poemarioComment.update({
      data: { text },
      where: { id: commentId },
    });
  } catch {
    return { ok: false, message: "No se pudo editar el comentario." };
  }

  revalidatePoemarioThread(comment.postId, commentId);

  return { ok: true, message: "comentario actualizado" };
}

export async function deletePoemarioCommentAction(
  commentId: string
): Promise<PoemarioCommentMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const prisma = getPrisma();
  const comment = await prisma.poemarioComment.findUnique({
    select: { parentId: true, postId: true },
    where: { id: commentId },
  });

  if (!comment) {
    return { ok: false, message: "Ese comentario ya no existe." };
  }

  try {
    await prisma.poemarioComment.delete({
      where: { id: commentId },
    });
  } catch {
    return { ok: false, message: "No se pudo borrar el comentario." };
  }

  revalidatePoemarioThread(comment.postId, commentId);

  if (comment.parentId) {
    revalidatePoemarioCommentPath(comment.postId, comment.parentId);
  }

  return { ok: true, message: "comentario borrado" };
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
    // The settings row was not updated, so the just-uploaded object is orphaned.
    try {
      await deleteR2Object(uploadedImage.key);
    } catch {
      // Best-effort cleanup; never mask the original save error.
    }

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

type ArchivoImageResult = {
  id: string;
  key: string;
  order: number;
  url: string;
};

type ArchivoMutationResult =
  | {
      ok: true;
      coverImageId?: string | null;
      description?: string;
      image?: ArchivoImageResult;
      images?: ArchivoImageResult[];
      postId?: string;
      takenAt?: string;
      title?: string | null;
    }
  | { ok: false; message: string };

type CreateArchivoPostMetadataResult =
  | { ok: true; message: string; postId: string }
  | { ok: false; message: string };

type UploadSingleArchivoImageResult =
  | { ok: true; image: ArchivoImageResult; images?: ArchivoImageResult[] }
  | { ok: false; message: string };

type GetArchivoImagesResult =
  | {
      ok: true;
      coverImageId: string | null;
      images: ArchivoImageResult[];
    }
  | { ok: false; message: string };

type CreateArchivoPostOptions = {
  kind?: string;
  title?: string;
};

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
      return `${prefix}La imagen procesada debe pesar menos de ${formatArchivoFileSize(
        ARCHIVO_IMAGE_MAX_SIZE_BYTES
      )}.`;
    case "unsupported_heic":
      return `${prefix}HEIC photos from iPhone are not supported yet. Please select Most Compatible/JPEG or convert them first.`;
    case "unsupported_video":
      return `${prefix}MOV/Live Photo videos no son compatibles. Selecciona solo fotos.`;
    case "invalid_type":
      return `${prefix}Usa imagenes JPG, PNG, WebP o GIF.`;
  }
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

function serializeArchivoImage(image: {
  id: string;
  key: string;
  order: number;
  url: string;
}): ArchivoImageResult {
  return {
    id: image.id,
    key: image.key,
    order: image.order,
    url: image.url,
  };
}

function normalizeArchivoKind(kind?: string) {
  return kind === ARCHIVO_ALBUM_KIND ? ARCHIVO_ALBUM_KIND : ARCHIVO_POST_KIND;
}

async function getOrderedArchivoImages(postId: string) {
  const images = await getPrisma().archiveImage.findMany({
    orderBy: { order: "asc" },
    where: { postId },
  });

  return images.map(serializeArchivoImage);
}

function revalidateArchivoAdmin(postId?: string) {
  revalidatePath(ARCHIVO_PATH);
  revalidatePath(ADMIN_PATH);

  if (postId) {
    revalidatePath(`${ARCHIVO_PATH}/${postId}`);
    revalidatePath(`${ARCHIVO_PATH}/album/${postId}`);
  }
}

export async function createArchivoPostMetadataAction(
  rawDescription: string,
  rawTakenAt: string,
  options: CreateArchivoPostOptions = {}
): Promise<CreateArchivoPostMetadataResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const kind = normalizeArchivoKind(options.kind);
  const title = options.title?.trim() ?? "";
  const description = rawDescription.trim();
  const takenAt = parseArchivoTakenAt(rawTakenAt);

  if (kind === ARCHIVO_ALBUM_KIND && !title) {
    return { ok: false, message: "Ponle titulo al album." };
  }

  if (!takenAt) {
    return { ok: false, message: "Elige una fecha valida." };
  }

  try {
    const post = await getPrisma().archivePost.create({
      data: {
        id: randomUUID(),
        kind,
        title: kind === ARCHIVO_ALBUM_KIND ? title : null,
        description,
        takenAt,
      },
      select: { id: true },
    });

    revalidateArchivoAdmin(post.id);

    return { ok: true, message: "archivo creado", postId: post.id };
  } catch {
    return { ok: false, message: "No se pudo crear el archivo." };
  }
}

export async function uploadSingleArchivoImageAction(
  postId: string,
  formData: FormData
): Promise<UploadSingleArchivoImageResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const file = formData.get("image");
  const shouldReturnImages = formData.get("returnImages") !== "false";

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecciona una imagen valida." };
  }

  const validation = validateImageFile(file);

  if (!validation.ok) {
    return {
      ok: false,
      message: imageErrorMessage(validation.reason, file.name),
    };
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    include: { images: { select: { order: true } } },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  const nextOrder =
    post.images.length > 0
      ? Math.max(...post.images.map((image) => image.order)) + 1
      : 0;
  const requestedOrderValue = Number(formData.get("order"));
  const requestedOrder =
    Number.isSafeInteger(requestedOrderValue) && requestedOrderValue >= 0
      ? requestedOrderValue
      : null;
  const usedOrders = new Set(post.images.map((image) => image.order));
  const imageOrder =
    requestedOrder !== null && !usedOrders.has(requestedOrder)
      ? requestedOrder
      : nextOrder;

  if (process.env.NODE_ENV === "development") {
    console.info("[archivo-upload:single] uploading", {
      extension: getArchivoImageFileInfo(file).extension,
      name: file.name,
      order: imageOrder,
      postId,
      size: file.size,
      type: file.type,
    });
  }

  let uploadedImage: Awaited<ReturnType<typeof uploadArchivoImageToR2>>;

  try {
    uploadedImage = await uploadArchivoImageToR2(
      file,
      postId,
      imageOrder,
      post.kind
    );
  } catch {
    return {
      ok: false,
      message: `${file.name}: No se pudo subir la imagen.`,
    };
  }

  let image: Awaited<ReturnType<typeof prisma.archiveImage.create>>;

  try {
    image = await prisma.archiveImage.create({
      data: {
        key: uploadedImage.key,
        order: imageOrder,
        postId,
        url: uploadedImage.url,
      },
    });
  } catch {
    // The DB row was not created, so the just-uploaded R2 object is orphaned
    // and safe to remove.
    await cleanupUploadedImages([uploadedImage.key]);

    return {
      ok: false,
      message: `${file.name}: No se pudo guardar la imagen.`,
    };
  }

  // Setting the album cover is best-effort: if it fails the image row is still
  // valid and cover resolution falls back to the first image everywhere, so we
  // must NOT delete the just-saved R2 object here.
  if (post.kind === ARCHIVO_ALBUM_KIND && !post.coverImageId) {
    try {
      await prisma.archivePost.update({
        data: { coverImageId: image.id },
        where: { id: postId },
      });
    } catch {
      // Leave the image intact; the first image will be used as the cover.
    }
  }

  revalidateArchivoAdmin(postId);

  return {
    ok: true,
    image: serializeArchivoImage(image),
    images: shouldReturnImages
      ? await getOrderedArchivoImages(postId)
      : undefined,
  };
}

export async function getArchivoImagesAction(
  postId: string
): Promise<GetArchivoImagesResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const post = await getPrisma().archivePost.findUnique({
    include: {
      images: { orderBy: { order: "asc" } },
    },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  return {
    ok: true,
    coverImageId: post.coverImageId,
    images: post.images.map(serializeArchivoImage),
  };
}

export async function updateArchivoCoverImageAction(
  postId: string,
  imageId: string
): Promise<ArchivoMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const image = await getPrisma().archiveImage.findUnique({
    select: { id: true, postId: true },
    where: { id: imageId },
  });

  if (!image || image.postId !== postId) {
    return { ok: false, message: "Esa imagen ya no existe." };
  }

  try {
    await getPrisma().archivePost.update({
      data: { coverImageId: imageId },
      where: { id: postId },
    });
  } catch {
    return { ok: false, message: "No se pudo cambiar la portada." };
  }

  revalidateArchivoAdmin(postId);

  return { ok: true, coverImageId: imageId };
}

export async function updateArchivoPostAction(
  postId: string,
  rawDescription: string,
  rawTakenAt: string,
  rawTitle?: string,
  coverImageId?: string | null
): Promise<ArchivoMutationResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "vuelve a iniciar sesion" };
  }

  const description = rawDescription.trim();
  const title = rawTitle?.trim() ?? "";
  const takenAt = parseArchivoTakenAt(rawTakenAt);

  if (!takenAt) {
    return { ok: false, message: "Elige una fecha valida." };
  }

  const prisma = getPrisma();
  const post = await prisma.archivePost.findUnique({
    select: { id: true, kind: true },
    where: { id: postId },
  });

  if (!post) {
    return { ok: false, message: "Ese archivo ya no existe." };
  }

  if (post.kind === ARCHIVO_ALBUM_KIND && !title) {
    return { ok: false, message: "Ponle titulo al album." };
  }

  if (coverImageId) {
    const coverImage = await prisma.archiveImage.findUnique({
      select: { postId: true },
      where: { id: coverImageId },
    });

    if (!coverImage || coverImage.postId !== postId) {
      return { ok: false, message: "Esa portada ya no existe." };
    }
  }

  try {
    const updatedPost = await prisma.archivePost.update({
      data: {
        coverImageId: coverImageId === undefined ? undefined : coverImageId,
        description,
        takenAt,
        title: post.kind === ARCHIVO_ALBUM_KIND ? title : null,
      },
      select: {
        coverImageId: true,
        description: true,
        takenAt: true,
        title: true,
      },
      where: { id: postId },
    });

    revalidateArchivoAdmin(postId);

    return {
      ok: true,
      coverImageId: updatedPost.coverImageId,
      description: updatedPost.description,
      takenAt: updatedPost.takenAt.toISOString(),
      title: updatedPost.title,
    };
  } catch {
    return { ok: false, message: "No se pudo guardar el archivo." };
  }
}

export async function removeArchivoImageAction(
  imageId: string
): Promise<ArchivoMutationResult> {
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
      const remainingImages = image.post.images.filter(
        (postImage) => postImage.id !== imageId
      );
      const nextCoverImageId =
        image.post.coverImageId === imageId
          ? remainingImages[0]?.id ?? null
          : image.post.coverImageId;

      await transaction.archiveImage.delete({ where: { id: imageId } });
      await transaction.archiveImage.updateMany({
        data: { order: { decrement: 1 } },
        where: {
          order: { gt: image.order },
          postId: image.postId,
        },
      });

      if (image.post.coverImageId !== nextCoverImageId) {
        await transaction.archivePost.update({
          data: { coverImageId: nextCoverImageId },
          where: { id: image.postId },
        });
      }
    });
  } catch {
    return { ok: false, message: "No se pudo quitar la imagen." };
  }

  try {
    await deleteR2Object(image.key);
  } catch {
    // The database already reflects the removal; R2 cleanup can be retried later.
  }

  revalidateArchivoAdmin(image.postId);

  return {
    ok: true,
    coverImageId:
      image.post.coverImageId === imageId
        ? image.post.images.find((postImage) => postImage.id !== imageId)?.id ??
          null
        : image.post.coverImageId,
    images: await getOrderedArchivoImages(image.postId),
  };
}

export async function reorderArchivoImagesAction(
  postId: string,
  imageIds: string[]
): Promise<ArchivoMutationResult> {
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

  revalidateArchivoAdmin(postId);

  return {
    ok: true,
    images: await getOrderedArchivoImages(postId),
  };
}

export async function deleteArchivoPostAction(
  postId: string
): Promise<ArchivoMutationResult> {
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
    await prisma.archivePost.update({
      data: { coverImageId: null },
      where: { id: postId },
    });
    await prisma.archivePost.delete({ where: { id: postId } });
  } catch {
    return { ok: false, message: "No se pudo borrar el archivo." };
  }

  await cleanupUploadedImages(post.images.map((image) => image.key));
  revalidateArchivoAdmin(postId);

  return { ok: true };
}
