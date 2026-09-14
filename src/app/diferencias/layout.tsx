import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import PoemarioViewportBackground from "@/app/nohaydiferenciasentreestoyunpoemario/poemario-viewport-background";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default function DiferenciasLayout({ children }: { children: ReactNode }) {
  return <PoemarioViewportBackground>{children}</PoemarioViewportBackground>;
}
