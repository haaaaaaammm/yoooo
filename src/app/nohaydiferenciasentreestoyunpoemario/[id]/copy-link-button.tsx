"use client";

import { useEffect, useState } from "react";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 5000);

    return () => clearTimeout(timeout);
  }, [copied]);

  async function copyLink() {
    const url = window.location.href;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    }

    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    setCopied(true);
  }

  return (
    <div className="flex flex-none items-center gap-2">
      {copied ? (
        <span className="text-xs text-neutral-500">link copied</span>
      ) : null}
      <button
        className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
        onClick={copyLink}
        type="button"
      >
        copy link
      </button>
    </div>
  );
}
