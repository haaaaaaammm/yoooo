import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OTROGATO_PATH } from "@/lib/posts";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function LegacyDiferenciasPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`${OTROGATO_PATH}/${encodeURIComponent(id)}`);
}
