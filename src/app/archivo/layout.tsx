import type { ReactNode } from "react";
import type { Viewport } from "next";

import ArchivoViewportBackground from "./archivo-viewport-background";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

type ArchivoLayoutProps = {
  children: ReactNode;
};

export default function ArchivoLayout({ children }: ArchivoLayoutProps) {
  return <ArchivoViewportBackground>{children}</ArchivoViewportBackground>;
}
