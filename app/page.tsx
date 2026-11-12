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

  if (!mounted) return <div className="min-h-dvh" />;
  return hasSession ? <Session /> : <Setup />;
}
