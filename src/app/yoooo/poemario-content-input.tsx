"use client";

import type { ChangeEventHandler } from "react";

type PoemarioContentInputProps = {
  content: string;
  maxLength?: number;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
};

export default function PoemarioContentInput({
  content,
  maxLength,
  onChange,
  placeholder = "en qué piensas y así??",
}: PoemarioContentInputProps) {
  return (
    <textarea
      className="min-h-32 w-full resize-y rounded-2xl border border-transparent bg-black px-1 text-md leading-7 text-white outline-none transition placeholder:text-neutral-500"
      maxLength={maxLength}
      name="content"
      onChange={onChange}
      placeholder={placeholder}
      required
      value={content}
    />
  );
}
