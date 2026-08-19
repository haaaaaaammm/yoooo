"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ARCHIVO_IMAGE_MAX_SIZE_BYTES,
  formatArchivoFileSize,
  getArchivoImageUploadType,
} from "@/lib/archivo";

import { createWalterBazarPostAction } from "./actions";
import PoemarioContentInput from "./poemario-content-input";

const AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

function avatarTypeError(reason: string) {
  switch (reason) {
    case "unsupported_heic":
      return "HEIC no es compatible. Elige una foto JPG o usa la opción Más compatible del iPhone.";
    case "unsupported_video":
      return "Los videos MOV o Live Photo no son compatibles.";
    default:
      return "Usa una imagen JPG, PNG, WebP o GIF.";
  }
}

export default function WalterBazarComposer() {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarReference, setAvatarReference] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const [content, setContent] = useState("");
  const [customAuthorName, setCustomAuthorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canSubmit =
    customAuthorName.trim().length > 0 &&
    content.trim().length > 0 &&
    (avatar !== null || avatarReference !== null) &&
    !isSubmitting;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setMessage(null);

    if (!file) {
      setAvatar(null);
      setAvatarReference(null);
      setPreviewUrl(null);
      return;
    }

    const uploadType = getArchivoImageUploadType(file);

    if (!uploadType.ok) {
      setAvatar(null);
      setAvatarReference(null);
      setPreviewUrl(null);
      setMessage(avatarTypeError(uploadType.reason));
      event.target.value = "";
      return;
    }

    if (file.size > ARCHIVO_IMAGE_MAX_SIZE_BYTES) {
      setAvatar(null);
      setAvatarReference(null);
      setPreviewUrl(null);
      setMessage(
        `La imagen debe pesar menos de ${formatArchivoFileSize(
          ARCHIVO_IMAGE_MAX_SIZE_BYTES
        )}.`
      );
      event.target.value = "";
      return;
    }

    setAvatar(file);
    setAvatarReference(null);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    if (!customAuthorName.trim()) {
      setMessage("Escribe el nombre de la persona.");
      return;
    }

    if (!avatar && !avatarReference) {
      setMessage("Selecciona una foto de perfil.");
      return;
    }

    if (!content.trim()) {
      setMessage("Escribe algo antes de publicar.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData(event.currentTarget);

      if (avatarReference) {
        formData.delete("customAuthorAvatar");
        formData.set("customAuthorAvatarKey", avatarReference.key);
      } else if (avatar) {
        formData.set("customAuthorAvatar", avatar, avatar.name);
      }

      const result = await createWalterBazarPostAction(formData);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setAvatarReference(result.avatar);
      setContent("");
      setMessage(null);
      router.refresh();
    } catch {
      setMessage("No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="border-b border-neutral-800 px-4 py-4"
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div className="flex min-w-0 items-center gap-3">
          {previewUrl ? (
            <img
              alt="Vista previa de la foto de perfil"
              className="h-14 w-14 flex-none rounded-full object-cover"
              height={56}
              src={previewUrl}
              width={56}
            />
          ) : (
            <div
              aria-label="Sin foto de perfil seleccionada"
              className="flex h-14 w-14 flex-none items-center justify-center rounded-full border border-dashed border-neutral-700 text-[10px] text-neutral-600"
            >
              foto
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              Walter Bazar
            </h2>
            <p className="text-sm leading-5 text-neutral-500">
              publica en poemario como otra persona
            </p>
          </div>
        </div>

        <label className="block min-w-0">
          <span className="mb-2 block text-sm text-neutral-400">nombre</span>
          <input
            autoComplete="off"
            className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
            name="customAuthorName"
            onChange={(event) => {
              setCustomAuthorName(event.target.value);
              setMessage(null);
            }}
            placeholder="Walter"
            required
            type="text"
            value={customAuthorName}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-sm text-neutral-400">
            foto de perfil
          </span>
          <input
            accept={AVATAR_ACCEPT}
            className="block w-full min-w-0 max-w-full overflow-hidden text-sm text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#ff003c]/10 file:px-4 file:py-2 file:text-sm file:text-[#ff003c]"
            name="customAuthorAvatar"
            onChange={handleAvatarChange}
            required={!avatarReference}
            type="file"
          />
          <span className="mt-2 block text-xs leading-5 text-neutral-500">
            JPG, PNG, WebP o GIF; máximo 5 MB
          </span>
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-sm text-neutral-400">post</span>
          <PoemarioContentInput
            content={content}
            onChange={(event) => {
              setContent(event.target.value);
              setMessage(null);
            }}
          />
        </label>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 border-t border-neutral-900 pt-3">
          {message ? (
            <p className="min-w-0 flex-1 text-sm text-red-400">{message}</p>
          ) : null}
          <button
            className="flex-none rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "posteando y asi" : "post"}
          </button>
        </div>
      </div>
    </form>
  );
}
