import "./globals.css";
import type { Metadata, Viewport } from "next";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Práctica de piano intercalada: mezcla solfeo, Hanon, canción a oído y John Thompson en bloques cortos para recordar más.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TimerPiano · Práctica de piano intercalada",
  description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TimerPiano" },
  openGraph: {
    type: "website",
    siteName: "TimerPiano",
    title: "TimerPiano",
    description,
    locale: "es_DO",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TimerPiano" }],
  },
  twitter: { card: "summary_large_image", title: "TimerPiano", description, images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#0b0b10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
