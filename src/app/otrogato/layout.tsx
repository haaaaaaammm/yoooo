import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import PoemarioViewportBackground from "@/app/nohaydiferenciasentreestoyunpoemario/poemario-viewport-background";

export const metadata: Metadata = {
  applicationName: "Otrogato",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Otrogato",
  },
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/icons/otrogato-180.png",
      },
    ],
  },
  manifest: "/manifests/otrogato.webmanifest",
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

export default function OtrogatoLayout({ children }: { children: ReactNode }) {
  return <PoemarioViewportBackground>{children}</PoemarioViewportBackground>;
}
