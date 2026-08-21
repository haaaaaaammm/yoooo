"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ProfileImage from "@/app/_components/profile-image";
import {
  ARCHIVO_IMAGE_MAX_SIZE_BYTES,
  getArchivoImageUploadType,
} from "@/lib/archivo";

import { updateAvatarAction } from "./actions";
import NotificationSettings from "./notification-settings";

const AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

type ProfilePanelProps = {
  avatarUrl: string | null;
  displayName: string;
  username: string;
  vapidPublicKey: string | null;
};

export default function ProfilePanel({
  avatarUrl,
  displayName,
  username,
  vapidPublicKey,
}: ProfilePanelProps) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    setMessage(null);

    if (!selected) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    if (
      !getArchivoImageUploadType(selected).ok ||
      selected.size > ARCHIVO_IMAGE_MAX_SIZE_BYTES
    ) {
      event.target.value = "";
      setFile(null);
      setPreviewUrl(null);
      setMessage("Usa una imagen JPG, PNG, WebP o GIF de máximo 5 MB.");
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function submitAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("avatar", file, file.name);
      const result = await updateAvatarAction(formData);

      setMessage(result.message);

      if (result.ok) {
        setFile(null);
        setPreviewUrl(null);
        router.refresh();
      }
    } catch {
      setMessage("No se pudo actualizar la foto.");
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <section className="border-b border-neutral-800 px-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProfileImage
          className="h-14 w-14 flex-none rounded-full object-cover"
          profileImageUrl={previewUrl ?? avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{displayName}</p>
          <p className="truncate text-sm text-neutral-500">@{username}</p>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submitAvatar}>
        <input
          accept={AVATAR_ACCEPT}
          className="block w-full min-w-0 max-w-full overflow-hidden text-sm text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#ff003c]/10 file:px-4 file:py-2 file:text-sm file:text-[#ff003c]"
          disabled={isPending}
          onChange={selectAvatar}
          type="file"
        />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {message ? (
            <p className="min-w-0 flex-1 text-sm text-neutral-400">{message}</p>
          ) : null}
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            disabled={!file || isPending}
            type="submit"
          >
            {isPending ? "subiendo" : "cambiar foto"}
          </button>
        </div>
      </form>
      <NotificationSettings vapidPublicKey={vapidPublicKey} />
    </section>
  );
}
