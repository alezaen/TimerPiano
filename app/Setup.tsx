"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, BLOCK_OPTIONS, MAX_AREA_MINUTES, STEP_MINUTES } from "@/lib/store";
import { AREAS, AREA_BY_ID } from "@/lib/areas";
import { buildBlocks } from "@/lib/interleave";
import { streak } from "@/lib/stats";
import { requestAudioPermission, playStart, playStep, playTap, playShuffle } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import Progress from "./Progress";

/** Botón táctil: un toque suma una vez; mantenerlo apretado repite rápido. */
function HoldButton({
  onStep,
  atLimit,
  label,
  className,
  children,
}: {
  onStep: () => void;
  atLimit: boolean;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rep = useRef<ReturnType<typeof setInterval> | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    if (rep.current) clearInterval(rep.current);
    timer.current = null;
    rep.current = null;
  };
  useEffect(() => clear, []);

  return (
    <button
      aria-label={label}
      aria-disabled={atLimit}
      className={`${className} select-none transition-transform active:scale-90 ${atLimit ? "opacity-30" : ""}`}
      onPointerDown={() => {
        held.current = false;
        clear();
        timer.current = setTimeout(() => {
          held.current = true;
          onStep();
          rep.current = setInterval(onStep, 140);
        }, 420);
      }}
      onPointerUp={() => {
        const wasHeld = held.current;
        clear();
        held.current = false;
        if (!wasHeld) onStep();
      }}
      onPointerCancel={() => {
        clear();
        held.current = false;
      }}
      onPointerLeave={() => {
        clear();
        held.current = false;
      }}
      onClick={(e) => {
        if (e.detail === 0) onStep();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function Setup() {
  const { minutes, blockMin, sound, history, setMinutes, setBlockMin, toggleSound, start } = useStore();
  const [seed, setSeed] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blocks = useMemo(() => buildBlocks(minutes, blockMin), [minutes, blockMin, seed]);
  const total = AREAS.reduce((t, a) => t + minutes[a.id], 0);
  const run = streak(history);

  const change = (id: (typeof AREAS)[number]["id"], delta: number) => {
    const st = useStore.getState();
    const cur = st.minutes[id];
    const next = Math.max(0, Math.min(MAX_AREA_MINUTES, cur + delta));
    if (next === cur) return;
    setMinutes(id, next);
    vibrate(8);
    if (st.sound) playStep(next / STEP_MINUTES);
  };

  const go = () => {
    if (blocks.length === 0) return;
    requestAudioPermission();
    if (sound) playStart();
    vibrate([30, 40, 30]);
    start(blocks);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-40 pt-[max(env(safe-area-inset-top),20px)]">
      <header className="flex items-center justify-between">
        <h1 className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">TimerPiano</h1>
        <div className="flex items-center gap-2">
          {run > 0 && (
            <span className="num rounded-full border border-line bg-card px-3 py-1 text-xs text-dim">
              Racha <span className="font-semibold text-fg">{run}</span>
            </span>
          )}
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? "Sonido activado" : "Sonido desactivado"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-dim"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
            </svg>
          </button>
        </div>
      </header>

      <section className="mt-8">
        <p className="text-sm text-dim">Hoy practicas</p>
        <p className="num text-7xl font-semibold leading-none tracking-tight">
          {total}
          <span className="ml-2 text-2xl font-medium text-dim">min</span>
        </p>
      </section>

      <section className="mt-6 space-y-2.5" aria-label="Minutos por área">
        {AREAS.map((a) => {
          const m = minutes[a.id];
          const on = m > 0;
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card py-3 pl-4 pr-3"
              style={{ opacity: on ? 1 : 0.55 }}
            >
              <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.label}</p>
                <p className="truncate text-xs text-dim">{a.hint}</p>
              </div>
              <HoldButton
                onStep={() => change(a.id, -STEP_MINUTES)}
                atLimit={m <= 0}
                label={`Menos minutos de ${a.label}`}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-2xl text-dim"
              >
                −
              </HoldButton>
              <span className="num w-9 text-center text-lg font-semibold">{m}</span>
              <HoldButton
                onStep={() => change(a.id, STEP_MINUTES)}
                atLimit={m >= MAX_AREA_MINUTES}
                label={`Más minutos de ${a.label}`}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-2xl text-fg"
              >
                +
              </HoldButton>
            </div>
          );
        })}
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-dim">Cambio de área cada</p>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-1.5" role="radiogroup">
          {BLOCK_OPTIONS.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={blockMin === n}
              onClick={() => {
                vibrate(8);
                if (sound) playTap();
                setBlockMin(n);
              }}
              className={`num h-11 rounded-xl text-sm font-semibold transition-colors ${
                blockMin === n ? "bg-gold text-ink" : "text-dim"
              }`}
            >
              {n} min
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Tu orden de hoy</p>
          <button
            onClick={() => {
              vibrate([10, 30, 10, 30, 10]);
              if (sound) playShuffle();
              setSeed((s) => s + 1);
            }}
            disabled={blocks.length < 2}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-gold disabled:opacity-30"
          >
            Mezclar de nuevo
          </button>
        </div>
        {blocks.length > 0 ? (
          <>
            <div key={seed} className="mt-3 flex h-3 gap-[3px]" aria-hidden>
              {blocks.map((b, i) => (
                <div
                  key={i}
                  className="tp-pop rounded-full"
                  style={{
                    flexGrow: b.seconds,
                    background: AREA_BY_ID[b.area].color,
                    animationDelay: `${Math.min(i, 30) * 22}ms`,
                  }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-dim">
              {blocks.length} {blocks.length === 1 ? "bloque" : "bloques"}, sin repetir área seguida.
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-dim">Suma minutos a al menos un área.</p>
        )}
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-dim">
          Mezclar se siente más difícil que repetir lo mismo. Es normal: esa dificultad es la que ayuda a recordarlo
          después.
        </p>
      </section>

      <Progress />

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/95 to-transparent">
        <div className="mx-auto max-w-md px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-8">
          <button
            onClick={go}
            disabled={blocks.length === 0}
            className="h-14 w-full rounded-2xl bg-gold text-base font-semibold text-ink shadow-lg shadow-black/40 transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Empezar · {total} min
          </button>
        </div>
      </div>
    </main>
  );
}
