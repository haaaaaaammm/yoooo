"use server";

import { revalidatePath } from "next/cache";

import {
  hashDiferenciasPassword,
  validateDiferenciasDisplayName,
  validateDiferenciasPassword,
  validateDiferenciasUsername,
} from "@/lib/diferencias-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  ADMIN_PATH,
  DIFERENCIAS_PATH,
  OTROGATO_PATH,
} from "@/lib/posts";
import { getPrisma } from "@/lib/prisma";
import {
  deleteR2Object,
  uploadDiferenciasAvatarToR2,
  validateProfileImageFile,
} from "@/lib/r2";

export type PlannedParenthoodResult = { message: string; ok: boolean };

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function revalidateAccounts() {
  revalidatePath(ADMIN_PATH);
  revalidatePath(DIFERENCIAS_PATH);
  revalidatePath(OTROGATO_PATH);
}

function imageError(reason: string) {
  return reason === "too_large"
    ? "La imagen debe pesar menos de 5 MB."
    : "Usa una imagen JPG, PNG, WebP o GIF.";
}

export async function createDiferenciasAccountAction(
  formData: FormData
): Promise<PlannedParenthoodResult> {
  if (!(await isAdminAuthenticated())) {
    return { message: "vuelve a iniciar sesion", ok: false };
  }

  const displayName = validateDiferenciasDisplayName(
    String(formData.get("displayName") ?? "")
  );
  const username = validateDiferenciasUsername(
    String(formData.get("username") ?? "")
  );
  const password = String(formData.get("password") ?? "");
  const avatar = formData.get("avatar");
  const hasAvatar = avatar instanceof File && avatar.size > 0;

  if (!displayName) {
    return { message: "Escribe un nombre válido.", ok: false };
  }

  if (!username) {
    return {
      message: "El usuario debe tener 3-32 letras, números, puntos, guiones o guion bajo.",
      ok: false,
    };
  }

  if (!validateDiferenciasPassword(password)) {
    return { message: "La contraseña debe tener entre 12 y 128 caracteres.", ok: false };
  }

  if (hasAvatar) {
    const validation = validateProfileImageFile(avatar);

    if (!validation.ok) {
      return { message: imageError(validation.reason), ok: false };
    }
  }

  let passwordHash: string;

  try {
    passwordHash = await hashDiferenciasPassword(password);
  } catch {
    return { message: "No se pudo proteger la contraseña.", ok: false };
  }

  let uploadedAvatar: Awaited<ReturnType<typeof uploadDiferenciasAvatarToR2>> | null = null;

  if (hasAvatar) {
    try {
      uploadedAvatar = await uploadDiferenciasAvatarToR2(avatar);
    } catch {
      return { message: "No se pudo subir la imagen.", ok: false };
    }
  }

  try {
    await getPrisma().diferenciasUser.create({
      data: {
        avatarKey: uploadedAvatar?.key,
        avatarUrl: uploadedAvatar?.url,
        displayName,
        passwordHash,
        username,
      },
    });
  } catch (error) {
    if (uploadedAvatar) {
      try {
        await deleteR2Object(uploadedAvatar.key);
      } catch {
        // Best-effort cleanup after failed account creation.
      }
    }

    return {
      message: isUniqueConstraintError(error)
        ? "Ese usuario ya está en uso."
        : "No se pudo crear la cuenta.",
      ok: false,
    };
  }

  revalidateAccounts();
  return { message: "cuenta creada", ok: true };
}

export async function updateDiferenciasDisplayNameAction(
  userId: string,
  rawDisplayName: string
): Promise<PlannedParenthoodResult> {
  if (!(await isAdminAuthenticated())) {
    return { message: "vuelve a iniciar sesion", ok: false };
  }

  const displayName = validateDiferenciasDisplayName(rawDisplayName);

  if (!displayName) {
    return { message: "Escribe un nombre válido.", ok: false };
  }

  try {
    await getPrisma().diferenciasUser.update({
      data: { displayName },
      where: { id: userId },
    });
  } catch {
    return { message: "No se pudo actualizar el nombre.", ok: false };
  }

  revalidateAccounts();
  return { message: "nombre actualizado", ok: true };
}

export async function resetDiferenciasPasswordAction(
  userId: string,
  password: string
): Promise<PlannedParenthoodResult> {
  if (!(await isAdminAuthenticated())) {
    return { message: "vuelve a iniciar sesion", ok: false };
  }

  if (!validateDiferenciasPassword(password)) {
    return { message: "La contraseña debe tener entre 12 y 128 caracteres.", ok: false };
  }

  let passwordHash: string;

  try {
    passwordHash = await hashDiferenciasPassword(password);
  } catch {
    return { message: "No se pudo proteger la contraseña.", ok: false };
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction([
      prisma.diferenciasUser.update({
        data: { passwordHash },
        where: { id: userId },
      }),
      prisma.diferenciasSession.deleteMany({ where: { userId } }),
    ]);
  } catch {
    return { message: "No se pudo cambiar la contraseña.", ok: false };
  }

  revalidateAccounts();
  return { message: "contraseña actualizada; sesiones cerradas", ok: true };
}

export async function setDiferenciasAccountActiveAction(
  userId: string,
  isActive: boolean
): Promise<PlannedParenthoodResult> {
  if (!(await isAdminAuthenticated())) {
    return { message: "vuelve a iniciar sesion", ok: false };
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction([
      prisma.diferenciasUser.update({
        data: { isActive },
        where: { id: userId },
      }),
      prisma.diferenciasSession.deleteMany({ where: { userId } }),
    ]);
  } catch {
    return { message: "No se pudo actualizar la cuenta.", ok: false };
  }

  revalidateAccounts();
  return {
    message: isActive ? "cuenta reactivada" : "cuenta desactivada y sesiones cerradas",
    ok: true,
  };
}

export async function updateDiferenciasAccountAvatarAction(
  userId: string,
  formData: FormData
): Promise<PlannedParenthoodResult> {
  if (!(await isAdminAuthenticated())) {
    return { message: "vuelve a iniciar sesion", ok: false };
  }

  const avatar = formData.get("avatar");

  if (!(avatar instanceof File)) {
    return { message: "Selecciona una imagen.", ok: false };
  }

  const validation = validateProfileImageFile(avatar);

  if (!validation.ok) {
    return { message: imageError(validation.reason), ok: false };
  }

  const prisma = getPrisma();
  const user = await prisma.diferenciasUser.findUnique({
    select: { avatarKey: true },
    where: { id: userId },
  });

  if (!user) {
    return { message: "La cuenta ya no existe.", ok: false };
  }

  let uploaded: Awaited<ReturnType<typeof uploadDiferenciasAvatarToR2>>;

  try {
    uploaded = await uploadDiferenciasAvatarToR2(avatar);
  } catch {
    return { message: "No se pudo subir la imagen.", ok: false };
  }

  try {
    await prisma.diferenciasUser.update({
      data: { avatarKey: uploaded.key, avatarUrl: uploaded.url },
      where: { id: userId },
    });
  } catch {
    try {
      await deleteR2Object(uploaded.key);
    } catch {
      // Best-effort orphan cleanup.
    }

    return { message: "No se pudo guardar la imagen.", ok: false };
  }

  if (user.avatarKey) {
    try {
      await deleteR2Object(user.avatarKey);
    } catch {
      // The new avatar is active; old-object cleanup must not block success.
    }
  }

  revalidateAccounts();
  return { message: "foto actualizada", ok: true };
}
