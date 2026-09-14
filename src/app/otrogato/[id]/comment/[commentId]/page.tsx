import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import { getOtrogatoLoginPath, OTROGATO_PATH } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "otrogato",
};

export default async function OtrogatoCommentCompatibilityPage({
  params,
}: {
  params: Promise<{ commentId: string; id: string }>;
}) {
  const { commentId, id } = await params;
  const postPath = `${OTROGATO_PATH}/${encodeURIComponent(id)}`;
  const commentPath = `${postPath}#comment-${encodeURIComponent(commentId)}`;
  const user = await getDiferenciasSessionUser();

  if (!user) {
    redirect(getOtrogatoLoginPath(commentPath));
  }

  redirect(commentPath);
}
