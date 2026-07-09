"use client";

import { useEffect, useRef, useState } from "react";

// Small three-dots menu for an archivo feed card. `path` is the archivo item's
// app path (e.g. /archivo/<id> or /archivo/album/<id>); "copiar link" copies the
// absolute URL (origin + path) to the clipboard.
export default function ArchivoCardMenu({ path }: { path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on outside click / Escape while the menu is open.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  async function copyLink() {
    const url = `${window.location.origin}${path}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.append(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
    } catch {
      // Ignore copy failures; the menu still closes.
    }

    setCopied(true);

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    // Briefly show "copiado", then close the menu and reset.
    resetTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, 1200);
  }

  return (
    <div className="relative flex-none" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="abrir opciones"
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c] focus:outline-none focus-visible:bg-[#ff003c]/10 focus-visible:text-[#ff003c]"
        onClick={() => {
          setCopied(false);
          setOpen((current) => !current);
        }}
        type="button"
      >
        {"â‹®"}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 min-w-32 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-lg shadow-black/40"
          role="menu"
        >
          <button
            aria-label="copiar link"
            className="block w-full px-4 py-2.5 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10"
            onClick={copyLink}
            role="menuitem"
            type="button"
          >
            {copied ? "copiado" : "copiar link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
