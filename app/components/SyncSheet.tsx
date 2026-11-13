"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { pendientes } from "@/lib/sync";

function hace(ms: number | null): string {
  if (!ms) return "nunca";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export default function SyncSheet({ onClose }: { onClose: () => void }) {
  const { auth, syncState, syncError, lastSync, sessions, login, logout, sync } = useStore();
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const pend = pendientes(sessions).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const conectar = async () => {
    if (!clave || cargando) return;
    setCargando(true);
    setError(null);
    const err = await login(clave);
    setCargando(false);
    if (err) setError(err);
    else setClave("");
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sincronizar"
        onClick={(e) => e.stopPropagation()}
        className="tp-up w-full max-w-md rounded-t-3xl border-t border-line bg-card px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sincronizar</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-full text-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {!auth ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              Pon tu contraseña una vez en cada dispositivo. Tus sesiones y minutos quedan guardados y aparecen igual en el
              teléfono y en la PC.
            </p>
            {syncError && <p className="mt-3 text-sm text-gold">{syncError}</p>}
            <input
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && conectar()}
              className="mt-4 h-14 w-full rounded-2xl border border-edge bg-ink/60 px-4 text-base outline-none focus:border-gold"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-[#ff8a7a]">
                {error}
              </p>
            )}
            <button
              onClick={conectar}
              disabled={!clave || cargando}
              className="mt-4 h-14 w-full rounded-2xl bg-gold text-base font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {cargando ? "Conectando…" : "Conectar"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-3 rounded-2xl border border-line bg-ink/40 p-4">
              <p className="text-sm font-medium">
                {syncState === "syncing"
                  ? "Sincronizando…"
                  : syncState === "error"
                    ? "No se pudo sincronizar"
                    : pend > 0
                      ? `${pend} ${pend === 1 ? "sesión por subir" : "sesiones por subir"}`
                      : "Todo al día"}
              </p>
              <p className="mt-1 text-xs text-dim">Última vez: {hace(lastSync)}</p>
              {syncError && <p className="mt-2 text-xs text-[#ff8a7a]">{syncError}</p>}
            </div>
            <button
              onClick={() => void sync()}
              disabled={syncState === "syncing"}
              className="mt-4 h-14 w-full rounded-2xl bg-gold text-base font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              Sincronizar ahora
            </button>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="mt-2 h-12 w-full rounded-2xl text-sm text-dim"
            >
              Desconectar este dispositivo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
