
import DeathClock from "./deathclock";
export const metadata = {
  title: "death clock",
  description: "://",
  openGraph: {
    title: "death clock",
    description: "://",
    url: "https://haaaaaaammmm.com/deathclock", // ← cambia por tu dominio real
    siteName: "death clock",
    images: [
      {
        url: "/images/deathclock.png", // ← pon tu imagen en /public/og-image.jpg
        width: 1200,
        height: 630,
        alt: "Death Clock Preview",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "death clock",
    description: "://",
    images: ["/images/deathclock.png"],
  },
};

export default function Page() {
  return <DeathClock />;
}