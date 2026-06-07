import type { ReactNode } from "react";
import type { Viewport } from "next";

import ArchiveViewportBackground from "./archive-viewport-background";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

type ArchiveLayoutProps = {
  children: ReactNode;
};

export default function ArchiveLayout({ children }: ArchiveLayoutProps) {
  return <ArchiveViewportBackground>{children}</ArchiveViewportBackground>;
}
