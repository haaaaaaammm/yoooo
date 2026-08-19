"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import ProfileImage from "@/app/_components/profile-image";

import { createPostAction } from "./actions";
import PoemarioContentInput from "./poemario-content-input";

function PublishButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-full px-5 py-2 text-sm  text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
      disabled={pending || !canSubmit}
      type="submit"
    >
      {pending ? "posteando y asi" : "post"}
    </button>
  );
}

export default function Composer({
  profileImageUrl,
}: {
  profileImageUrl?: string | null;
}) {
  const [content, setContent] = useState("");
  const trimmedLength = content.trim().length;
  const canSubmit = trimmedLength > 0;

  return (
    <form
      action={createPostAction}
      className="border-b border-neutral-800 px-4 py-4"
    >
      <div className="flex gap-3">
        <ProfileImage
          className="mt-1 h-10 w-10 flex-none rounded-full object-cover"
          profileImageUrl={profileImageUrl}
        />
        <div className="min-w-0 flex-1">
          <PoemarioContentInput
            content={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="en qué piensas y así??"
          />
          <div className="mt-3 flex items-center justify-end border-t border-neutral-900 pt-3">
            <PublishButton canSubmit={canSubmit} />
          </div>
        </div>
      </div>
    </form>
  );
}
