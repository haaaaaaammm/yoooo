import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OTROGATO_PATH } from "@/lib/posts";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default function LegacyDiferenciasPage() {
  redirect(OTROGATO_PATH);
}
