"use client";

import { useEffect } from "react";

/** Registra el service worker (public/sw.js): con él TimerPiano abre y funciona sin internet después de la primera visita. */
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
