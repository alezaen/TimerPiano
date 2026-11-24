"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, remainingSeconds } from "@/lib/store";
import { sumSeconds } from "@/lib/areas";
import { useAreas } from "@/lib/useAreas";
import { dayKey, historyOf, plannedBy, secondsInLastDays, streak } from "@/lib/stats";
import { playBlockStart, playCountdown, playPause, playResume, playSessionEnd } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { repertorioConSesion } from "@/lib/links";
import { useT } from "@/lib/useT";
import type { Clave } from "@/lib/i18n";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const mins = (s: number) => Math.round(s / 60);
/** 45 min · 1 h 05 */
const dur = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

/** Título y frase del resumen según lo que se logró frente a lo planeado. */
function mensaje(pct: number, total: number, run: number): { title: Clave; text: Clave; n?: number } {
  if (total === 0) return { title: "sesionTerminada", text: "noAlcanzaste" };
  if (pct >= 100) return { title: "sesionCompleta", text: run >= 3 ? "cumplisteRacha" : "cumpliste", n: run };
  if (pct >= 70) return { title: "granSesion", text: "casiTodo" };
  return { title: "sesionGuardada", text: "cadaMinuto" };
}

export default function Session() {
  const session = useStore((s) => s.session);
  if (!session) return null;
  return session.status === "done" ? <Done /> : <Running />;
}

function Running() {
  const { session, sound, pause, resume, skip, finish, tick } = useStore();
  const t = useT();
  const { byId: AREA_BY_ID } = useAreas();
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastIndex = useRef(session!.index);
  const lastSec = useRef(-1);

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
  const progress = 1 - secs / block.seconds;

  // Cambio de bloque: la "firma" sonora de cada área.
  useEffect(() => {
    if (s.index !== lastIndex.current) {
      lastIndex.current = s.index;
      if (sound) playBlockStart(s.blocks[s.index].area);
      vibrate([60, 40, 60]);
    }
  }, [s.index, s.blocks, sound]);

  // Cuenta atrás de los últimos 3 segundos.
  useEffect(() => {
    if (!running) {
      lastSec.current = -1;
      return;
    }
    if (secs > 3) lastSec.current = -1;
    if (secs >= 1 && secs <= 3 && secs !== lastSec.current) {
      lastSec.current = secs;
      if (sound) playCountdown(secs);
      vibrate(12);
    }
  }, [secs, running, sound]);

  useEffect(() => {
    document.title = `${mmss(secs)} · ${area.label}`;
    return () => {
      document.title = "TimerPiano";
    };
  }, [secs, area.label]);

  const toggle = () => {
    if (running) {
      pause();
      if (sound) playPause();
      vibrate(20);
    } else {
      resume();
      if (sound) playResume();
      vibrate([12, 30, 12]);
    }
  };

  const R = 46;
  const C = 2 * Math.PI * R;

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
          const fill = i < s.index ? 1 : i === s.index ? progress : 0;
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
          {t("bloqueDe", { i: s.index + 1, n: s.blocks.length })}
        </p>
        <h2 key={s.index} className="tp-fade mt-3 text-4xl font-semibold tracking-tight" style={{ color: area.color }}>
          {area.label}
        </h2>
        <p className="mt-1 text-sm text-dim">{area.hint}</p>

        <button
          onClick={toggle}
          aria-label={running ? t("pausar") : t("seguir")}
          className={`relative mt-7 aspect-square w-[min(76vw,310px)] rounded-full transition-transform active:scale-[0.97] ${
            running && secs <= 10 ? "tp-pulse" : ""
          }`}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="3.5" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={area.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.3s linear", opacity: running ? 1 : 0.45 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="num text-[clamp(3.2rem,17vw,5rem)] font-semibold leading-none tracking-tight"
              style={{ opacity: running ? 1 : 0.45 }}
            >
              {mmss(secs)}
            </span>
            <span className="mt-3 text-xs font-medium text-dim">{running ? t("tocaPausar") : t("enPausa")}</span>
          </div>
        </button>

        <div className="mt-8 h-6 text-sm text-dim">
          {next ? (
            <>
              {t("sigue")}{" "}
              <span className="font-medium" style={{ color: AREA_BY_ID[next.area].color }}>
                {AREA_BY_ID[next.area].label}
              </span>{" "}
              · {mins(next.seconds)} min
            </>
          ) : (
            t("ultimoBloque")
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="h-16 flex-1 rounded-2xl bg-gold text-lg font-semibold text-ink transition-transform active:scale-[0.98]"
          >
            {running ? t("pausar") : t("seguir")}
          </button>
          <button
            onClick={() => {
              vibrate(15);
              skip();
            }}
            className="h-16 w-28 rounded-2xl border border-line bg-card text-base font-medium text-fg transition-transform active:scale-[0.97] active:bg-line"
          >
            {t("saltar")}
          </button>
        </div>

        <div className="mt-3 flex h-11 items-center justify-center">
          {confirmEnd ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-dim">{t("terminarPregunta")}</span>
              <button onClick={finish} className="rounded-lg px-3 py-2 font-semibold text-gold">
                {t("si")}
              </button>
              <button onClick={() => setConfirmEnd(false)} className="rounded-lg px-3 py-2 text-dim">
                {t("no")}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmEnd(true)} className="rounded-lg px-4 py-2 text-sm text-dim">
              {t("terminarSesion")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Done() {
  const { session, sessions, close, sound } = useStore();
  const t = useT();
  const { areas: AREAS } = useAreas();
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (sound) playSessionEnd();
    vibrate([80, 60, 80, 60, 160]);
  }, [sound]);

  const s = session!;
  const total = sumSeconds(s.done);
  const plan = plannedBy(s.blocks);
  const planned = sumSeconds(plan);
  const pct = planned > 0 ? Math.min(100, Math.round((total / planned) * 100)) : 0;
  const history = historyOf(sessions);
  const run = streak(history);
  const today = sumSeconds(history[dayKey()]);
  const week = secondsInLastDays(history, 7);
  const rec = s.recordId ? sessions.find((x) => x.id === s.recordId) : undefined;
  const msg = mensaje(pct, total, run);
  const title = t(msg.title);
  const text = t(msg.text, { n: msg.n ?? 0 });
  const rows = AREAS.filter((a) => plan[a.id] > 0 || s.done[a.id] > 0);

  // Anillo: un arco por área (su color), del tamaño de lo practicado frente a lo planeado.
  const R = 46;
  const C = 2 * Math.PI * R;
  const GAP = 2;
  const base = Math.max(planned, total, 1);
  let acc = 0;
  const arcs = AREAS.filter((a) => s.done[a.id] > 0).map((a) => {
    const len = Math.max(0, (s.done[a.id] / base) * C - GAP);
    const arc = { id: a.id, color: a.color, len, off: -acc };
    acc += (s.done[a.id] / base) * C;
    return arc;
  });

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),20px)]">
      <div
        aria-hidden
        className="tp-fade pointer-events-none absolute inset-x-0 top-0 h-[60%]"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--color-gold) 22%, transparent), transparent 75%)" }}
      />

      <div className="relative flex flex-1 flex-col justify-center py-6">
        <p className="tp-fade text-center text-xs font-semibold uppercase tracking-[0.22em] text-gold">{total > 0 ? t("sesionGuardada") : t("sesionTerminada")}</p>
        <h1 className="tp-fade mt-2 text-center text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="tp-fade mx-auto mt-2 max-w-[18rem] text-center text-sm text-dim">{text}</p>

        <div className="relative mx-auto mt-6 aspect-square w-[min(68vw,260px)]" role="img" aria-label={t("anilloAria", { a: mins(total), b: mins(planned) })}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="5" />
            {arcs.map((a) => (
              <circle
                key={a.id}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${a.len} ${C}`}
                strokeDashoffset={a.off}
                style={{ filter: `drop-shadow(0 0 3px ${a.color})` }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="num text-[clamp(3.6rem,19vw,5rem)] font-semibold leading-none tracking-tight">{mins(total)}</p>
            <p className="mt-1 text-sm font-medium text-dim">{t("minPracticados")}</p>
            {planned > 0 && <p className="num mt-1 text-xs text-dim">{t("pctPlaneado", { n: pct })}</p>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-line bg-card px-2 py-3">
            <p className="num text-2xl font-semibold leading-none">
              {run > 0 && <span aria-hidden>🔥</span>}
              {run}
            </p>
            <p className="mt-1.5 text-xs text-dim">{run === 1 ? t("diaRacha") : t("diasRacha")}</p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-2 py-3">
            <p className="num text-2xl font-semibold leading-none">{dur(today)}</p>
            <p className="mt-1.5 text-xs text-dim">{t("hoy")}</p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-2 py-3">
            <p className="num text-2xl font-semibold leading-none">{dur(week)}</p>
            <p className="mt-1.5 text-xs text-dim">{t("ultimos7")}</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 rounded-2xl border border-line bg-card p-4">
          {rows.map((a) => {
            const done = s.done[a.id];
            const goal = plan[a.id];
            const ok = goal > 0 && done >= goal * 0.9;
            return (
              <div key={a.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span style={{ color: a.color }} className="font-medium">
                    {a.label}
                  </span>
                  <span className="num text-dim">
                    {ok && (
                      <span aria-label={t("completado")} className="mr-1.5 font-semibold" style={{ color: a.color }}>
                        ✓
                      </span>
                    )}
                    {mins(done)}
                    {goal > 0 ? ` / ${mins(goal)}` : ""} min
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="tp-grow h-full rounded-full"
                    style={{ width: `${Math.min(100, (done / Math.max(goal, done, 1)) * 100)}%`, background: a.color }}
                  />
                </div>
              </div>
            );
          })}
          {total === 0 && <p className="text-sm text-dim">{t("noPracticaste")}</p>}
        </div>
      </div>

      <div className="relative">
        {rec && (
          <a
            href={repertorioConSesion(rec)}
            className="mb-3 flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-card text-sm font-semibold transition-transform active:scale-[0.98]"
          >
            {t("sumarEarPiano")}
          </a>
        )}
        <button
          onClick={close}
          className="h-14 w-full rounded-2xl bg-gold text-base font-semibold text-ink transition-transform active:scale-[0.98]"
        >
          {t("volverInicio")}
        </button>
      </div>
    </main>
  );
}
