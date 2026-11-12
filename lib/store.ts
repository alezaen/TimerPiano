"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AreaId, Block, Minutes, Seconds, Session } from "./types";
import { AREA_IDS, emptySeconds, sumSeconds } from "./areas";
import { dayKey } from "./stats";

export const MAX_AREA_MINUTES = 60;
export const STEP_MINUTES = 5;
export const BLOCK_OPTIONS = [3, 5, 10] as const;
const HISTORY_DAYS = 400;

interface State {
  minutes: Minutes;
  blockMin: number;
  sound: boolean;
  history: Record<string, Seconds>;
  session: Session | null;

  setMinutes: (id: AreaId, minutes: number) => void;
  setBlockMin: (n: number) => void;
  toggleSound: () => void;

  start: (blocks: Block[]) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  tick: () => void;
  finish: () => void;
  close: () => void;
  recover: () => void;
}

/** Segundos que le quedan al bloque actual. */
export function remainingSeconds(s: Session, now = Date.now()): number {
  if (s.status === "running" && s.endAt !== null) return Math.max(0, Math.ceil((s.endAt - now) / 1000));
  if (s.status === "paused") return s.remaining;
  return 0;
}

function commit(history: Record<string, Seconds>, done: Seconds): Record<string, Seconds> {
  if (sumSeconds(done) <= 0) return history;
  const key = dayKey();
  const prev = history[key] ?? emptySeconds();
  const merged = { ...prev };
  for (const id of AREA_IDS) merged[id] = prev[id] + done[id];
  const next = { ...history, [key]: merged };
  const keys = Object.keys(next).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_DAYS))) delete next[k];
  return next;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 },
      blockMin: 5,
      sound: true,
      history: {},
      session: null,

      setMinutes: (id, m) =>
        set((s) => ({ minutes: { ...s.minutes, [id]: Math.max(0, Math.min(MAX_AREA_MINUTES, m)) } })),
      setBlockMin: (n) => set({ blockMin: n }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),

      start: (blocks) => {
        if (blocks.length === 0) return;
        set({
          session: {
            blocks,
            index: 0,
            status: "running",
            endAt: Date.now() + blocks[0].seconds * 1000,
            remaining: blocks[0].seconds,
            done: emptySeconds(),
          },
        });
      },

      pause: () => {
        const s = get().session;
        if (!s || s.status !== "running") return;
        set({ session: { ...s, status: "paused", remaining: remainingSeconds(s), endAt: null } });
      },

      resume: () => {
        const s = get().session;
        if (!s || s.status !== "paused") return;
        set({ session: { ...s, status: "running", endAt: Date.now() + s.remaining * 1000 } });
      },

      tick: () => {
        const s = get().session;
        if (!s || s.status !== "running" || s.endAt === null) return;
        const now = Date.now();
        if (now < s.endAt) return;

        let { index, endAt } = s;
        const done = { ...s.done };
        while (now >= endAt) {
          const b = s.blocks[index];
          done[b.area] += b.seconds;
          if (index === s.blocks.length - 1) {
            set({
              session: { ...s, index, status: "done", endAt: null, remaining: 0, done },
              history: commit(get().history, done),
            });
            return;
          }
          index++;
          endAt += s.blocks[index].seconds * 1000;
        }
        set({ session: { ...s, index, endAt, remaining: s.blocks[index].seconds, done } });
      },

      skip: () => {
        const s = get().session;
        if (!s || s.status === "done") return;
        const block = s.blocks[s.index];
        const elapsed = Math.max(0, block.seconds - remainingSeconds(s));
        const done = { ...s.done };
        done[block.area] += elapsed;

        if (s.index === s.blocks.length - 1) {
          set({
            session: { ...s, status: "done", endAt: null, remaining: 0, done },
            history: commit(get().history, done),
          });
          return;
        }
        const next = s.blocks[s.index + 1];
        set({
          session: {
            ...s,
            index: s.index + 1,
            done,
            remaining: next.seconds,
            endAt: s.status === "running" ? Date.now() + next.seconds * 1000 : null,
          },
        });
      },

      finish: () => {
        const s = get().session;
        if (!s || s.status === "done") return;
        const block = s.blocks[s.index];
        const done = { ...s.done };
        done[block.area] += Math.max(0, block.seconds - remainingSeconds(s));
        set({
          session: { ...s, status: "done", endAt: null, remaining: 0, done },
          history: commit(get().history, done),
        });
      },

      close: () => set({ session: null }),

      /** Al reabrir la app con una sesión en curso, queda en pausa (no cuenta el tiempo cerrado). */
      recover: () => {
        const s = get().session;
        if (!s || s.status !== "running") return;
        const left = s.endAt !== null ? Math.ceil((s.endAt - Date.now()) / 1000) : 0;
        const full = s.blocks[s.index].seconds;
        set({
          session: {
            ...s,
            status: "paused",
            endAt: null,
            remaining: left > 0 ? Math.min(left, full) : full,
          },
        });
      },
    }),
    {
      name: "timerpiano-v2",
      partialize: (s) => ({
        minutes: s.minutes,
        blockMin: s.blockMin,
        sound: s.sound,
        history: s.history,
        session: s.session,
      }),
    },
  ),
);
