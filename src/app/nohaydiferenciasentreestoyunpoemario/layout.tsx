import type { ReactNode } from "react";
import type { Viewport } from "next";

import PoemarioViewportBackground from "./poemario-viewport-background";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

type PoemarioLayoutProps = {
  children: ReactNode;
};

export default function PoemarioLayout({ children }: PoemarioLayoutProps) {
  return <PoemarioViewportBackground>{children}</PoemarioViewportBackground>;
}
