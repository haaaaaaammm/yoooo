"use client";

import { useEffect, type ReactNode } from "react";

const POEMARIO_VIEWPORT_CLASS = "poemario-viewport-black";

type PoemarioViewportBackgroundProps = {
  children: ReactNode;
};

export default function PoemarioViewportBackground({
  children,
}: PoemarioViewportBackgroundProps) {
  useEffect(() => {
    document.documentElement.classList.add(POEMARIO_VIEWPORT_CLASS);
    document.body.classList.add(POEMARIO_VIEWPORT_CLASS);

    return () => {
      document.documentElement.classList.remove(POEMARIO_VIEWPORT_CLASS);
      document.body.classList.remove(POEMARIO_VIEWPORT_CLASS);
    };
  }, []);

  return (
    <div className="min-h-screen min-h-dvh bg-black text-white">
      {children}
    </div>
  );
}
