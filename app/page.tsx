"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useWakeLock } from "@/lib/wakeLock";
import Setup from "./components/Setup";
import Session from "./components/Session";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const status = useStore((s) => s.session?.status);
  const hasSession = useStore((s) => s.session !== null);

  useEffect(() => {
    try {
      localStorage.removeItem("timerpiano-v1");
    } catch {}
    useStore.getState().recover();
    setMounted(true);
  }, []);

  useWakeLock(status === "running");

  // Sincroniza al abrir, al volver a la app y poco después de cada cambio (sesión terminada o ajustes).
  useEffect(() => {
    if (!mounted) return;
    const st = useStore;
    const hayQueSubir = () => {
      const s = st.getState();
      return Boolean(s.auth) && (s.sessions.some((x) => x.p) || s.ajustesTs > s.ajustesOk);
    };
    void st.getState().sync();

    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = st.subscribe((nuevo, previo) => {
      // Solo cuando cambian las sesiones o los ajustes (así un fallo de red no provoca reintentos sin fin).
      if (nuevo.sessions === previo.sessions && nuevo.ajustesTs === previo.ajustesTs) return;
      if (!hayQueSubir()) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => void st.getState().sync(), 2500);
    });
    const onVisible = () => document.visibilityState === "visible" && void st.getState().sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsub();
      if (t) clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mounted]);

  if (!mounted) return <div className="min-h-dvh" />;
  return hasSession ? <Session /> : <Setup />;
}
