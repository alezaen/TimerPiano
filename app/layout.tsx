import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TimerPiano",
  description: "Práctica de piano intercalada: mezcla solfeo, Hanon, oído y repertorio.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-512.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TimerPiano" },
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
