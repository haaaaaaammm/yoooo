import Link from "next/link";

import { isAdminAuthenticated } from "@/lib/auth";
import { ADMIN_PATH } from "@/lib/posts";

type AdminPostLinkProps = {
  href?: string;
};

export default async function AdminPostLink({
  href = ADMIN_PATH,
}: AdminPostLinkProps) {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Link
      className="flex flex-none items-center rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
      href={href}
    >
      post
    </Link>
  );
}
