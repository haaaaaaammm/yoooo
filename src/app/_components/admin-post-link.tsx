import Link from "next/link";

import { isAdminAuthenticated } from "@/lib/auth";
import { ADMIN_PATH } from "@/lib/posts";

export default async function AdminPostLink() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Link
      className="flex flex-none items-center rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
      href={ADMIN_PATH}
    >
      post
    </Link>
  );
}
