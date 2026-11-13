import type { SessionRecord, Seconds } from "./types";
import { AREA_IDS, emptySeconds, sumSeconds } from "./areas";

export const dayKey = (d: Date = new Date()): string => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

/** Un día cuenta para la racha si practicaste al menos 1 minuto. */
const MIN_SECONDS = 60;

export function streak(history: Record<string, Seconds>): number {
  const d = new Date();
  if (sumSeconds(history[dayKey(d)]) < MIN_SECONDS) d.setDate(d.getDate() - 1);
  let n = 0;
  while (sumSeconds(history[dayKey(d)]) >= MIN_SECONDS) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Últimos `n` días, el más antiguo primero; el último es hoy. */
export function lastDays(n: number): { key: string; label: string; isToday: boolean }[] {
  const names = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return { key: dayKey(d), label: names[d.getDay()], isToday: i === n - 1 };
  });
}

/** Suma las sesiones por día: { "2026-11-13": { solfeo: 300, ... } }. */
export function historyOf(sessions: SessionRecord[]): Record<string, Seconds> {
  const out: Record<string, Seconds> = {};
  for (const s of sessions) {
    const day = (out[s.f] ??= emptySeconds());
    for (const id of AREA_IDS) day[id] += s.d[id];
  }
  return out;
}
