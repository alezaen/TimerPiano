"use client";

import { useStore } from "@/lib/store";
import { AREAS, sumSeconds } from "@/lib/areas";
import { lastDays, streak } from "@/lib/stats";

const mins = (s: number) => Math.round(s / 60);

export default function Progress() {
  const history = useStore((s) => s.history);
  const days = lastDays(7);
  const totals = days.map((d) => sumSeconds(history[d.key]));
  const maxSec = Math.max(30 * 60, ...totals);
  const weekSec = totals.reduce((a, b) => a + b, 0);
  const byArea = AREAS.map((a) => ({
    ...a,
    sec: days.reduce((t, d) => t + (history[d.key]?.[a.id] ?? 0), 0),
  }));
  const maxArea = Math.max(1, ...byArea.map((a) => a.sec));
  const run = streak(history);

  return (
    <section className="mt-10" aria-labelledby="progreso">
      <h2 id="progreso" className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">
        Tu semana
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="num text-3xl font-semibold">{run}</p>
          <p className="mt-1 text-xs text-dim">{run === 1 ? "día de racha" : "días de racha"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="num text-3xl font-semibold">
            {mins(weekSec)}
            <span className="ml-1 text-base text-dim">min</span>
          </p>
          <p className="mt-1 text-xs text-dim">últimos 7 días</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex h-28 items-end gap-2">
          {days.map((d, i) => {
            const day = history[d.key];
            const heightPct = (totals[i] / maxSec) * 100;
            return (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-md bg-line/60"
                    style={{ height: totals[i] > 0 ? `${Math.max(heightPct, 6)}%` : "4px" }}
                    aria-label={`${mins(totals[i])} minutos`}
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
      </div>

      {weekSec > 0 && (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-card p-4">
          {byArea.map((a) => (
            <div key={a.id}>
              <div className="flex justify-between text-xs">
                <span className="text-dim">{a.label}</span>
                <span className="num text-fg">{mins(a.sec)} min</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(a.sec / maxArea) * 100}%`, background: a.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

