"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { sumSeconds } from "@/lib/areas";
import { useAreas } from "@/lib/useAreas";
import { historyOf, lastDays, streak } from "@/lib/stats";
import { useT } from "@/lib/useT";
import { DIAS_SEMANA } from "@/lib/i18n";

const mins = (s: number) => Math.round(s / 60);
/** 45 min · 1 h 05 */
const dur = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

export default function Progress() {
  const sessions = useStore((s) => s.sessions);
  const lang = useStore((s) => s.lang);
  const t = useT();
  const { areas: AREAS } = useAreas();
  const history = useMemo(() => historyOf(sessions), [sessions]);
  const days = lastDays(7, DIAS_SEMANA[lang]);
  const totals = days.map((d) => sumSeconds(history[d.key]));
  const maxSec = Math.max(30 * 60, ...totals);
  const weekSec = totals.reduce((a, b) => a + b, 0);
  const byArea = AREAS.map((a) => ({
    ...a,
    sec: days.reduce((t, d) => t + (history[d.key]?.[a.id] ?? 0), 0),
  }));
  const maxArea = Math.max(1, ...byArea.map((a) => a.sec));
  const run = streak(history);
  const activeDays = totals.filter((t) => t >= 60).length;
  const best = totals.reduce((bi, t, i) => (t > totals[bi] ? i : bi), 0);

  if (weekSec === 0) {
    const hasHistory = Object.keys(history).length > 0;
    return (
      <section className="mt-10" aria-labelledby="progreso">
        <h2 id="progreso" className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">
          {t("tuSemana")}
        </h2>
        <div className="mt-3 rounded-2xl border border-dashed border-edge bg-card p-5 text-center">
          <div className="flex justify-center gap-3" aria-hidden>
            {days.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${d.isToday ? "bg-gold" : "bg-line"}`} />
                <span className={`text-[11px] ${d.isToday ? "font-semibold text-gold" : "text-dim"}`}>{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium">
            {hasHistory ? t("semanaSinPractica") : t("primeraSesion")}
          </p>
          <p className="mt-1 text-xs text-dim">{t("aquiVeras")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10" aria-labelledby="progreso">
      <h2 id="progreso" className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">
        {t("tuSemana")}
      </h2>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-line bg-card px-2 py-3">
          <p className="num text-2xl font-semibold leading-none">
            {run > 0 && <span aria-hidden>🔥</span>}
            {run}
          </p>
          <p className="mt-1.5 text-xs text-dim">{run === 1 ? t("diaRacha") : t("diasRacha")}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-2 py-3">
          <p className="num text-2xl font-semibold leading-none">{dur(weekSec)}</p>
          <p className="mt-1.5 text-xs text-dim">{t("ultimos7")}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-2 py-3">
          <p className="num text-2xl font-semibold leading-none">
            {activeDays}
            <span className="text-base text-dim">/7</span>
          </p>
          <p className="mt-1.5 text-xs text-dim">{t("diasPracticados")}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex h-32 items-end gap-2">
          {days.map((d, i) => {
            const day = history[d.key];
            const heightPct = (totals[i] / maxSec) * 100;
            return (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={`num h-3 text-[10px] leading-none ${i === best ? "font-semibold text-fg" : "text-dim"}`}>
                  {totals[i] > 0 ? mins(totals[i]) : ""}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`flex w-full flex-col-reverse overflow-hidden rounded-lg bg-line/60 ${d.isToday ? "ring-1 ring-gold/70" : ""}`}
                    style={{ height: totals[i] > 0 ? `${Math.max(heightPct, 6)}%` : "4px" }}
                    aria-label={t("minutosAria", { n: mins(totals[i]) })}
                  >
                    {day &&
                      AREAS.map((a) => (
                        <div
                          key={a.id}
                          style={{ flexGrow: day[a.id], background: a.color }}
                        />
                      ))}
                  </div>
                </div>
                <span className={`text-[11px] font-medium ${d.isToday ? "text-gold" : "text-dim"}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        {totals[best] > 0 && (
          <p className="mt-3 border-t border-line pt-3 text-center text-xs text-dim">
            {t("mejorDia")} <span className="font-semibold text-fg">{days[best].isToday ? t("hoy") : days[best].label}</span> · {dur(totals[best])}
          </p>
        )}
      </div>

      <div className="mt-3 space-y-3.5 rounded-2xl border border-line bg-card p-4">
        {byArea.map((a) => (
          <div key={a.id}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span style={{ color: a.color }} className="font-medium">
                {a.label}
              </span>
              <span className="num text-dim">
                <span className="text-fg">{dur(a.sec)}</span> · {Math.round((a.sec / weekSec) * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${(a.sec / maxArea) * 100}%`, background: a.color }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
