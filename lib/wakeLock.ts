"use client";

import { useEffect, useRef } from "react";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || !active) return;
      try {
        const sentinel: WakeLockSentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        // usuario denegó o no soportado
      }
    };

    if (active) {
      acquire();
    } else {
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active && !sentinelRef.current) {
        acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
