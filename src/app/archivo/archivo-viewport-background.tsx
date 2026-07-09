"use client";

import { useEffect, type ReactNode } from "react";

const ARCHIVO_VIEWPORT_CLASS = "archivo-viewport-black";

type ArchivoViewportBackgroundProps = {
  children: ReactNode;
};

export default function ArchivoViewportBackground({
  children,
}: ArchivoViewportBackgroundProps) {
  useEffect(() => {
    document.documentElement.classList.add(ARCHIVO_VIEWPORT_CLASS);
    document.body.classList.add(ARCHIVO_VIEWPORT_CLASS);

    return () => {
      document.documentElement.classList.remove(ARCHIVO_VIEWPORT_CLASS);
      document.body.classList.remove(ARCHIVO_VIEWPORT_CLASS);
    };
  }, []);

  return (
    <div className="min-h-screen min-h-dvh bg-black text-white">
      {children}
    </div>
  );
}
