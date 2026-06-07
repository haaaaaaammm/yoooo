"use client";

import { useEffect, type ReactNode } from "react";

const ARCHIVE_VIEWPORT_CLASS = "archive-viewport-black";

type ArchiveViewportBackgroundProps = {
  children: ReactNode;
};

export default function ArchiveViewportBackground({
  children,
}: ArchiveViewportBackgroundProps) {
  useEffect(() => {
    document.documentElement.classList.add(ARCHIVE_VIEWPORT_CLASS);
    document.body.classList.add(ARCHIVE_VIEWPORT_CLASS);

    return () => {
      document.documentElement.classList.remove(ARCHIVE_VIEWPORT_CLASS);
      document.body.classList.remove(ARCHIVE_VIEWPORT_CLASS);
    };
  }, []);

  return (
    <div className="min-h-screen min-h-dvh bg-black text-white">
      {children}
    </div>
  );
}
