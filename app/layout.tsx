import "./globals.css";
import type { Metadata, Viewport } from "next";
import RegistrarSW from "./components/RegistrarSW";

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
  },
  twitter: { card: "summary", title: "TimerPiano", description },
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
      <body className="antialiased">
        <RegistrarSW />
        {children}
      </body>
    </html>
  );
}
