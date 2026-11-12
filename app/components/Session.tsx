"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, remainingSeconds } from "@/lib/store";
import { AREAS, AREA_BY_ID, sumSeconds } from "@/lib/areas";
import { streak } from "@/lib/stats";
import { playBlockStart, playSessionEnd } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const mins = (s: number) => Math.round(s / 60);

export default function Session() {
  const session = useStore((s) => s.session);
  if (!session) return null;
  return session.status === "done" ? <Done /> : <Running />;
}

function Running() {
  const { session, sound, pause, resume, skip, finish, tick } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastIndex = useRef(session!.index);

  const running = session!.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tick();
      setNow(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [running, tick]);

  // Al volver a la app tras bloquear el teléfono, se pone al día al instante.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tick]);

  const s = session!;
  const block = s.blocks[s.index];
  const area = AREA_BY_ID[block.area];
  const secs = remainingSeconds(s, now);
  const next = s.blocks[s.index + 1];

  useEffect(() => {
    if (s.index !== lastIndex.current) {
      lastIndex.current = s.index;
      if (sound) playBlockStart();
      vibrate([60, 40, 60]);
    }
  }, [s.index, sound]);

  useEffect(() => {
    document.title = `${mmss(secs)} · ${area.label}`;
    return () => {
      document.title = "TimerPiano";
    };
  }, [secs, area.label]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
      <div
        key={block.area + s.index}
        aria-hidden
        className="tp-fade pointer-events-none absolute inset-x-0 top-0 h-[70%]"
        style={{
          background: `radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, ${area.color} 26%, transparent), transparent 75%)`,
        }}
      />

      <div className="relative flex gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={s.blocks.length} aria-valuenow={s.index}>
        {s.blocks.map((b, i) => {
          const fill = i < s.index ? 1 : i === s.index ? 1 - secs / b.seconds : 0;
          return (
            <div key={i} className="h-1.5 overflow-hidden rounded-full bg-line" style={{ flexGrow: b.seconds, flexBasis: 0 }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${fill * 100}%`, background: AREA_BY_ID[b.area].color, transition: "width 0.3s linear" }}
              />
            </div>
          );
        })}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dim">
          Bloque {s.index + 1} de {s.blocks.length}
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight" style={{ color: area.color }}>
          {area.label}
        </h2>
        <p className="mt-1 text-sm text-dim">{area.hint}</p>

        <p
          className="num mt-8 text-[22vw] font-semibold leading-none tracking-tight sm:text-8xl"
          style={{ opacity: running ? 1 : 0.45 }}
          aria-live="off"
        >
          {mmss(secs)}
        </p>
        {!running && <p className="mt-3 text-sm font-medium text-gold">En pausa</p>}

        <div className="mt-10 h-10 text-sm text-dim">
          {next ? (
            <>
              Sigue:{" "}
              <span className="font-medium" style={{ color: AREA_BY_ID[next.area].color }}>
                {AREA_BY_ID[next.area].label}
              </span>{" "}
              · {mins(next.seconds)} min
            </>
          ) : (
            "Este es el último bloque"
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              vibrate(15);
              if (running) pause();
              else resume();
            }}
            className="h-16 flex-1 rounded-2xl bg-gold text-lg font-semibold text-ink transition-transform active:scale-[0.98]"
          >
            {running ? "Pausar" : "Seguir"}
          </button>
          <button
            onClick={() => {
              vibrate(15);
              skip();
            }}
            className="h-16 w-28 rounded-2xl border border-line bg-card text-base font-medium text-fg active:bg-line"
          >
            Saltar
          </button>
        </div>

        <div className="mt-3 flex h-11 items-center justify-center">
          {confirmEnd ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-dim">¿Terminar y guardar lo practicado?</span>
              <button onClick={finish} className="rounded-lg px-3 py-2 font-semibold text-gold">
                Sí
              </button>
              <button onClick={() => setConfirmEnd(false)} className="rounded-lg px-3 py-2 text-dim">
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmEnd(true)} className="rounded-lg px-4 py-2 text-sm text-dim">
              Terminar sesión
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Done() {
  const { session, history, close, sound } = useStore();
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (sound) playSessionEnd();
    vibrate([80, 60, 80, 60, 160]);
  }, [sound]);

  const s = session!;
  const total = sumSeconds(s.done);
  const max = Math.max(1, ...AREAS.map((a) => s.done[a.id]));
  const run = streak(history);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),20px)]">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          {total > 0 ? "Sesión guardada" : "Sesión terminada"}
        </p>
        <p className="num mt-3 text-7xl font-semibold leading-none tracking-tight">
          {mins(total)}
          <span className="ml-2 text-2xl font-medium text-dim">min</span>
        </p>
        {run > 0 && (
          <p className="mt-3 text-sm text-dim">
            Racha: <span className="font-semibold text-fg">{run}</span> {run === 1 ? "día" : "días"}
          </p>
        )}

        <div className="mt-8 space-y-4 rounded-2xl border border-line bg-card p-4">
          {AREAS.filter((a) => s.done[a.id] > 0).map((a) => (
            <div key={a.id}>
              <div className="flex justify-between text-sm">
                <span style={{ color: a.color }} className="font-medium">
                  {a.label}
                </span>
                <span className="num text-dim">{mins(s.done[a.id])} min</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${(s.done[a.id] / max) * 100}%`, background: a.color }} />
              </div>
            </div>
          ))}
          {total === 0 && <p className="text-sm text-dim">No alcanzaste a practicar nada esta vez.</p>}
        </div>
      </div>

      <button
        onClick={close}
        className="h-14 w-full rounded-2xl bg-gold text-base font-semibold text-ink transition-transform active:scale-[0.98]"
      >
        Volver al inicio
      </button>
    </main>
  );
}
