"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getDiferenciasLoginIp,
  getDiferenciasSessionUser,
  loginDiferenciasUser,
  logoutDiferenciasUser,
} from "@/lib/diferencias-auth";
import {
  DIFERENCIAS_COMMENT_MAX_LENGTH,
  DIFERENCIAS_CONTENT_MAX_LENGTH,
  DIFERENCIAS_PATH,
  OTROGATO_PATH,
} from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";
import {
  deleteR2Object,
  uploadDiferenciasAvatarToR2,
  validateProfileImageFile,
} from "@/lib/r2";

type MutationResult = { message: string; ok: boolean };

export type LoginState = MutationResult;

function avatarErrorMessage(reason: string) {
  switch (reason) {
    case "missing":
      return "Selecciona una imagen.";
    case "too_large":
      return "La imagen debe pesar menos de 5 MB.";
    case "unsupported_heic":
      return "HEIC no es compatible. Selecciona una foto JPG.";
    case "unsupported_video":
      return "Los videos o Live Photos no son compatibles.";
    default:
      return "Usa una imagen JPG, PNG, WebP o GIF.";
  }
}

function revalidateDiferencias(postId?: string, commentId?: string | null) {
  revalidatePath(DIFERENCIAS_PATH);
  revalidatePath(OTROGATO_PATH);

  if (postId) {
    revalidatePath(`${DIFERENCIAS_PATH}/${postId}`);
    revalidatePath(`${OTROGATO_PATH}/${postId}`);
  }

  if (postId && commentId) {
    revalidatePath(`${DIFERENCIAS_PATH}/${postId}/comment/${commentId}`);
  }
}

export async function loginAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  let result;

  try {
    result = await loginDiferenciasUser(
      username,
      password,
      await getDiferenciasLoginIp()
    );
  } catch {
    return { message: "Could not log in. Please try again.", ok: false };
  }

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return {
        message: "Too many attempts. Please wait and try again.",
        ok: false,
      };
    }

    if (result.reason === "disabled") {
      return { message: "This account is currently disabled.", ok: false };
    }

    return { message: "Invalid username or password.", ok: false };
  }

  redirect(OTROGATO_PATH);
}

export async function logoutAction() {
  await logoutDiferenciasUser();
  revalidatePath(OTROGATO_PATH);
  redirect(OTROGATO_PATH);
}

export async function createPostAction(formData: FormData): Promise<MutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  const rawContent = String(formData.get("content") ?? "");

  if (rawContent.length > DIFERENCIAS_CONTENT_MAX_LENGTH) {
    return { message: "El post es demasiado largo.", ok: false };
  }

  const content = rawContent.trim();

  if (!content) {
    return { message: "Escribe algo antes de publicar.", ok: false };
  }

  try {
    await getPrisma().diferenciasPost.create({
      data: { authorId: user.id, content },
    });
  } catch {
    return { message: "No se pudo publicar. Inténtalo de nuevo.", ok: false };
  }

  revalidateDiferencias();
  return { message: "posteado", ok: true };
}

export async function updatePostAction(
  postId: string,
  rawContent: string
): Promise<MutationResult & { content?: string }> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  if (rawContent.length > DIFERENCIAS_CONTENT_MAX_LENGTH) {
    return { message: "El post es demasiado largo.", ok: false };
  }

  const content = rawContent.trim();

  if (!content) {
    return { message: "Escribe algo antes de guardar.", ok: false };
  }

  try {
    const result = await getPrisma().diferenciasPost.updateMany({
      data: { content },
      where: { authorId: user.id, id: postId },
    });

    if (result.count !== 1) {
      return { message: "No puedes editar ese post.", ok: false };
    }
  } catch {
    return { message: "No se pudo editar el post.", ok: false };
  }

  revalidateDiferencias(postId);
  return { content, message: "post actualizado", ok: true };
}

export async function deletePostAction(postId: string): Promise<MutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  try {
    const result = await getPrisma().diferenciasPost.deleteMany({
      where: { authorId: user.id, id: postId },
    });

    if (result.count !== 1) {
      return { message: "No puedes borrar ese post.", ok: false };
    }
  } catch {
    return { message: "No se pudo borrar el post.", ok: false };
  }

  revalidateDiferencias(postId);
  return { message: "post borrado", ok: true };
}

export async function updateAvatarAction(
  formData: FormData
): Promise<MutationResult & { avatarUrl?: string }> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return { message: "Selecciona una imagen.", ok: false };
  }

  const validation = validateProfileImageFile(file);

  if (!validation.ok) {
    return { message: avatarErrorMessage(validation.reason), ok: false };
  }

  const prisma = getPrisma();
  const existingUser = await prisma.diferenciasUser.findUnique({
    select: { avatarKey: true },
    where: { id: user.id },
  });

  if (!existingUser) {
    return { message: "La cuenta ya no existe.", ok: false };
  }

  let uploaded: Awaited<ReturnType<typeof uploadDiferenciasAvatarToR2>>;

  try {
    uploaded = await uploadDiferenciasAvatarToR2(file);
  } catch {
    return { message: "No se pudo subir la imagen.", ok: false };
  }

  try {
    await prisma.diferenciasUser.update({
      data: { avatarKey: uploaded.key, avatarUrl: uploaded.url },
      where: { id: user.id },
    });
  } catch {
    try {
      await deleteR2Object(uploaded.key);
    } catch {
      // Best-effort orphan cleanup.
    }

    return { message: "No se pudo guardar la imagen.", ok: false };
  }

  if (existingUser.avatarKey) {
    try {
      await deleteR2Object(existingUser.avatarKey);
    } catch {
      // The new avatar is active; old-object cleanup must not block success.
    }
  }

  revalidateDiferencias();
  return { avatarUrl: uploaded.url, message: "foto actualizada", ok: true };
}

export async function createCommentAction(
  postId: string,
  parentId: string | null,
  rawText: string
): Promise<MutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  if (rawText.length > DIFERENCIAS_COMMENT_MAX_LENGTH) {
    return { message: "El comentario es demasiado largo.", ok: false };
  }

  const text = rawText.trim();

  if (!text) {
    return { message: "Escribe algo antes de comentar.", ok: false };
  }

  const prisma = getPrisma();
  const post = await prisma.diferenciasPost.findUnique({
    select: { id: true },
    where: { id: postId },
  });

  if (!post) {
    return { message: "Ese post ya no existe.", ok: false };
  }

  if (parentId) {
    const parent = await prisma.diferenciasComment.findUnique({
      select: { postId: true },
      where: { id: parentId },
    });

    if (!parent || parent.postId !== postId) {
      return { message: "Ese comentario ya no existe.", ok: false };
    }
  }

  try {
    await prisma.diferenciasComment.create({
      data: { authorId: user.id, parentId, postId, text },
    });
  } catch {
    return { message: "No se pudo guardar el comentario.", ok: false };
  }

  revalidateDiferencias(postId, parentId);
  return { message: "comentario guardado", ok: true };
}

export async function updateCommentAction(
  commentId: string,
  rawText: string
): Promise<MutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  if (rawText.length > DIFERENCIAS_COMMENT_MAX_LENGTH) {
    return { message: "El comentario es demasiado largo.", ok: false };
  }

  const text = rawText.trim();

  if (!text) {
    return { message: "Escribe un comentario válido.", ok: false };
  }

  const prisma = getPrisma();
  const comment = await prisma.diferenciasComment.findUnique({
    select: { postId: true },
    where: { id: commentId, authorId: user.id },
  });

  if (!comment) {
    return { message: "No puedes editar ese comentario.", ok: false };
  }

  try {
    await prisma.diferenciasComment.update({
      data: { text },
      where: { id: commentId, authorId: user.id },
    });
  } catch {
    return { message: "No se pudo editar el comentario.", ok: false };
  }

  revalidateDiferencias(comment.postId, commentId);
  return { message: "comentario actualizado", ok: true };
}

export async function deleteCommentAction(
  commentId: string
): Promise<MutationResult> {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return { message: "Vuelve a iniciar sesión.", ok: false };
  }

  const prisma = getPrisma();
  const comment = await prisma.diferenciasComment.findUnique({
    select: { postId: true },
    where: { id: commentId, authorId: user.id },
  });

  if (!comment) {
    return { message: "No puedes borrar ese comentario.", ok: false };
  }

  try {
    await prisma.diferenciasComment.delete({
      where: { id: commentId, authorId: user.id },
    });
  } catch {
    return { message: "No se pudo borrar el comentario.", ok: false };
  }

  revalidateDiferencias(comment.postId, commentId);
  return { message: "comentario borrado", ok: true };
}
