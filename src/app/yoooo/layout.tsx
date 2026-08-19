import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  applicationName: "Yoooo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Yoooo",
  },
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/icons/yoooo-180.png",
      },
    ],
  },
  manifest: "/manifests/yoooo.webmanifest",
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function YooooLayout({ children }: { children: ReactNode }) {
  return children;
}
