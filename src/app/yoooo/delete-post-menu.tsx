"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { deletePostAction } from "./actions";

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="block w-full px-4 py-2 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("delete?")) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {pending ? "deleteando" : "deletealo"}
    </button>
  );
}

type DeletePostMenuProps = {
  onEdit: () => void;
  postId: string;
};

export default function DeletePostMenu({ onEdit, postId }: DeletePostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    };
  }, []);

  return (
    <div className="relative z-10 ml-auto shrink-0 self-start" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label="Open post menu"
        className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[#ff003c] transition hover:bg-[#ff003c]/10"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        ...
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-xl shadow-black">
          <button
            className="block w-full px-4 py-2 text-left text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            type="button"
          >
            editar
          </button>
          <form action={deletePostAction}>
            <input name="postId" type="hidden" value={postId} />
            <DeleteButton />
          </form>
        </div>
      ) : null}
    </div>
  );
}
