"use client";

import { ChangeEvent, useActionState, useRef } from "react";

import { updateProfileImageAction } from "./actions";

type ProfileImageUploadState = {
  ok: boolean;
  message: string | null;
};

const initialState: ProfileImageUploadState = {
  ok: false,
  message: null,
};

export default function ProfileImageUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    updateProfileImageAction,
    initialState
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      action={formAction}
      className="flex min-w-0 items-center gap-2"
      ref={formRef}
    >
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        name="profileImage"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <button
        className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        cambiar foto
      </button>
      {state.message ? (
        <p
          className={
            state.ok
              ? "max-w-28 truncate text-xs text-green-400"
              : "max-w-28 truncate text-xs text-red-400"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
