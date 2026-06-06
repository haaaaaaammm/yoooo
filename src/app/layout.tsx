import type { Metadata } from "next";
import "./globals.css";


export const metadata = {
  title: "yo",
  description: ":pp",
  openGraph: {
    title: "yo",
    description: ":pp",
    url: "https://haaaaaaammmm.com", // ← cambia por tu dominio real
    siteName: "yo",
    images: [
      {
        url: "/images/YO.jpeg", // ← pon tu imagen en /public/og-image.jpg
        width: 1200,
        height: 630,
        alt: "yo Preview",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "yo",
    description: ":pp",
    images: ["/images/YO.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <meta name="theme-color" content="#000000" />
      <body
       
      >
        {children}
      </body>
    </html>
  );
}
