"use client";

import { useFormStatus } from "react-dom";

export default function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500"
      disabled={pending}
      type="submit"
    >
      {pending ? "logging out..." : "logout"}
    </button>
  );
}
