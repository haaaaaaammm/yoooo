import type { ReactNode } from "react";
import type { Viewport } from "next";

import PoemarioViewportBackground from "@/app/nohaydiferenciasentreestoyunpoemario/poemario-viewport-background";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

export default function DiferenciasLayout({ children }: { children: ReactNode }) {
  return <PoemarioViewportBackground>{children}</PoemarioViewportBackground>;
}
