"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ProfileImage from "@/app/_components/profile-image";
import PoemarioContentInput from "@/app/yoooo/poemario-content-input";
import { DIFERENCIAS_CONTENT_MAX_LENGTH } from "@/lib/posts";

import { createPostAction } from "./actions";

type ComposerProps = {
  avatarUrl: string | null;
  displayName: string;
};

export default function Composer({ avatarUrl, displayName }: ComposerProps) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [content, setContent] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canSubmit = content.trim().length > 0 && !isPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);
    setMessage(null);

    try {
      const result = await createPostAction(new FormData(event.currentTarget));

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setContent("");
      router.refresh();
    } catch {
      setMessage("No se pudo publicar. Inténtalo de nuevo.");
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <form className="border-b border-neutral-800 px-4 py-4" onSubmit={submit}>
      <div className="flex min-w-0 gap-3">
        <ProfileImage
          className="mt-1 h-10 w-10 flex-none rounded-full object-cover"
          profileImageUrl={avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="mb-2 truncate text-sm font-semibold text-white">
            {displayName}
          </p>
          <PoemarioContentInput
            content={content}
            maxLength={DIFERENCIAS_CONTENT_MAX_LENGTH}
            onChange={(event) => {
              setContent(event.target.value);
              setMessage(null);
            }}
            placeholder="en qué piensas y así??"
          />
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-end gap-3 border-t border-neutral-900 pt-3">
            {message ? (
              <p className="min-w-0 flex-1 text-sm text-red-400">{message}</p>
            ) : null}
            <button
              className="rounded-full px-5 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
              disabled={!canSubmit}
              type="submit"
            >
              {isPending ? "posteando y asi" : "post"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
