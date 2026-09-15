"use client";

import { EllipsisVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { getPostOptionItems } from "@/lib/post-options";

type DeleteFormAction = (formData: FormData) => void | Promise<void>;

type PostOptionsMenuProps = {
  canonicalPath: string;
  deleteAction?: DeleteFormAction;
  deleteValue?: string;
  isDeleting?: boolean;
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void;
};

function DeleteFormButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="block w-full px-4 py-2.5 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("delete?")) {
          event.preventDefault();
        }
      }}
      role="menuitem"
      type="submit"
    >
      {pending ? "deleteando" : "deletealo"}
    </button>
  );
}

export default function PostOptionsMenu({
  canonicalPath,
  deleteAction,
  deleteValue,
  isDeleting = false,
  onDelete,
  onEdit,
}: PostOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const options = getPostOptionItems({
    canDelete: Boolean((deleteAction && deleteValue) || onDelete),
    canEdit: Boolean(onEdit),
  });

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  async function copyLink() {
    const url = new URL(canonicalPath, window.location.origin).href;

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

      setCopied(true);

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }

      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1_200);
    } catch {
      setCopied(false);
    }
  }

  async function deletePost() {
    if (!onDelete || !window.confirm("delete?")) {
      return;
    }

    setPendingDelete(true);

    try {
      await onDelete();
      setOpen(false);
    } finally {
      setPendingDelete(false);
    }
  }

  return (
    <div
      className="relative z-20 ml-auto shrink-0 self-start"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      ref={menuRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open post menu"
        className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c] focus:outline-none focus-visible:bg-[#ff003c]/10 focus-visible:text-[#ff003c]"
        onClick={() => {
          setCopied(false);
          setOpen((current) => !current);
        }}
        type="button"
      >
        <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-36 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-lg shadow-black/40"
          role="menu"
        >
          <button
            className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10"
            onClick={copyLink}
            role="menuitem"
            type="button"
          >
            {copied ? "link copied" : "copy link"}
          </button>

          {options.includes("edit") && onEdit ? (
            <button
              className="block w-full px-4 py-2.5 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 focus:outline-none focus-visible:bg-[#ff003c]/10"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              role="menuitem"
              type="button"
            >
              editar
            </button>
          ) : null}

          {options.includes("delete") && deleteAction && deleteValue ? (
            <form action={deleteAction}>
              <input name="postId" type="hidden" value={deleteValue} />
              <DeleteFormButton />
            </form>
          ) : null}

          {options.includes("delete") && onDelete ? (
            <button
              className="block w-full px-4 py-2.5 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500"
              disabled={isDeleting || pendingDelete}
              onClick={deletePost}
              role="menuitem"
              type="button"
            >
              {isDeleting || pendingDelete ? "deleteando" : "deletealo"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
