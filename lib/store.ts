"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AreaConfig, AreaId, AreaOverrides, Block, Minutes, Seconds, Session, SessionRecord } from "./types";
import { emptySeconds, limpiarConfig, limpiarOverrides, sumSeconds } from "./areas";
import { dayKey } from "./stats";
import { MAX_SESSIONS, mezclar, pendientes, uid } from "./sync";
import { sanear } from "./sanear";
import { LANG_POR_DEFECTO, type Lang } from "./i18n";

export const MAX_AREA_MINUTES = 120;
export const STEP_MINUTES = 5;
export const BLOCK_OPTIONS = [3, 5, 10] as const;

export type Auth = { token: string; expira: number };
export type SyncState = "idle" | "syncing" | "ok" | "error";

interface State {
  minutes: Minutes;
  blockMin: number;
  sound: boolean;
  /** Idioma de la interfaz (solo en este aparato). */
  lang: Lang;
  /** Nombre, descripción y color que la persona le puso a cada área (solo en este aparato). */
  areaNames: AreaOverrides;
  sessions: SessionRecord[];
  session: Session | null;

  /** Cuándo se cambiaron por última vez los ajustes aquí, y cuál fue la última fecha ya sincronizada. */
  ajustesTs: number;
  ajustesOk: number;
  auth: Auth | null;
  syncState: SyncState;
  syncError: string | null;
  lastSync: number | null;
  login: (clave: string) => Promise<string | null>;
  logout: () => void;
  sync: () => Promise<void>;

  setMinutes: (id: AreaId, minutes: number) => void;
  setBlockMin: (n: number) => void;
  toggleSound: () => void;
  setLang: (l: Lang) => void;
  /** Cambia cómo se ve un área. Un campo vacío o inválido vuelve al valor de fábrica. */
  setAreaConfig: (id: AreaId, patch: Partial<AreaConfig>) => void;
  resetArea: (id: AreaId) => void;

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

function addSession(sessions: SessionRecord[], done: Seconds): SessionRecord[] {
  if (sumSeconds(done) <= 0) return sessions;
  const rec: SessionRecord = { id: uid(), f: dayKey(), d: { ...done }, p: 1 };
  return [...sessions, rec].slice(-MAX_SESSIONS);
}

/** Guarda la sesión en el historial (si se practicó algo) y devuelve su id, para poder llevarla a Acordes y Tonos. */
function guardarSesion(sessions: SessionRecord[], done: Seconds): { sessions: SessionRecord[]; recordId: string | null } {
  const nuevas = addSession(sessions, done);
  return { sessions: nuevas, recordId: sumSeconds(done) > 0 ? nuevas[nuevas.length - 1].id : null };
}

/**
 * localStorage que nunca lanza errores: si está bloqueado (navegación privada, permisos) o lleno, la app sigue funcionando
 * en esta visita y simplemente no guarda (antes, cada acción lanzaba un error).
 */
const almacenSeguro = {
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {}
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {}
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 },
      blockMin: 5,
      sound: true,
      lang: LANG_POR_DEFECTO,
      areaNames: {},
      sessions: [],
      session: null,
      ajustesTs: 0,
      ajustesOk: 0,
      auth: null,
      syncState: "idle",
      syncError: null,
      lastSync: null,

      setMinutes: (id, m) =>
        set((s) => ({
          minutes: { ...s.minutes, [id]: Math.max(0, Math.min(MAX_AREA_MINUTES, m)) },
          ajustesTs: Date.now(),
        })),
      setBlockMin: (n) => set({ blockMin: n, ajustesTs: Date.now() }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setLang: (lang) => set({ lang }),

      setAreaConfig: (id, patch) =>
        set((s) => {
          // Un texto vacío borra ese campo (vuelve al valor de fábrica); lo demás se junta con lo que ya había.
          const actual: Record<string, unknown> = { ...(s.areaNames[id] ?? {}) };
          for (const [k, v] of Object.entries(patch)) {
            if (typeof v === "string" && v.trim() === "") delete actual[k];
            else actual[k] = v;
          }
          const limpio = limpiarConfig(actual);
          const areaNames = { ...s.areaNames };
          if (Object.keys(limpio).length) areaNames[id] = limpio;
          else delete areaNames[id];
          return { areaNames, ajustesTs: Date.now() };
        }),
      resetArea: (id) =>
        set((s) => {
          const areaNames = { ...s.areaNames };
          delete areaNames[id];
          return { areaNames, ajustesTs: Date.now() };
        }),

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
            const g = guardarSesion(get().sessions, done);
            set({
              session: { ...s, index, status: "done", endAt: null, remaining: 0, done, recordId: g.recordId },
              sessions: g.sessions,
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
          const g = guardarSesion(get().sessions, done);
          set({
            session: { ...s, status: "done", endAt: null, remaining: 0, done, recordId: g.recordId },
            sessions: g.sessions,
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
        const g = guardarSesion(get().sessions, done);
        set({
          session: { ...s, status: "done", endAt: null, remaining: 0, done, recordId: g.recordId },
          sessions: g.sessions,
        });
      },

      login: async (clave) => {
        try {
          const res = await fetch("/api/entrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clave }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return (data as { error?: string }).error ?? "No se pudo entrar";
          set({ auth: { token: data.token, expira: data.expira }, syncState: "idle", syncError: null });
          await get().sync();
          return null;
        } catch {
          return "Sin conexión. Intenta de nuevo.";
        }
      },

      logout: () => set({ auth: null, syncState: "idle", syncError: null }),

      sync: async () => {
        const st = get();
        if (st.syncState === "syncing") return;
        const { auth } = st;
        if (!auth) return;
        if (auth.expira < Date.now()) {
          set({ auth: null, syncState: "idle", syncError: "Tu sesión venció. Vuelve a conectar." });
          return;
        }
        set({ syncState: "syncing", syncError: null });
        try {
          const subir = pendientes(st.sessions).slice(0, 100).map(({ id, f, d }) => ({ id, f, d }));
          const res = await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: auth.token,
              sesiones: subir,
              ajustes: { minutes: st.minutes, blockMin: st.blockMin, ts: st.ajustesTs, areaNames: st.areaNames },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 401) {
            set({ auth: null, syncState: "idle", syncError: "Tu sesión venció. Vuelve a conectar." });
            return;
          }
          if (!res.ok) {
            set({ syncState: "error", syncError: (data as { error?: string }).error ?? "No se pudo sincronizar" });
            return;
          }
          const { sesiones, ajustes } = data as {
            sesiones: SessionRecord[];
            ajustes: { minutes: Minutes; blockMin: number; ts: number; areaNames?: AreaOverrides } | null;
          };
          const ahora = get();
          const patch: Partial<State> = {
            sessions: mezclar(ahora.sessions, sesiones),
            syncState: "ok",
            lastSync: Date.now(),
          };
          if (ajustes && ajustes.ts > ahora.ajustesTs) {
            patch.minutes = ajustes.minutes;
            patch.blockMin = ajustes.blockMin;
            if (ajustes.areaNames) patch.areaNames = limpiarOverrides(ajustes.areaNames);
            patch.ajustesTs = ajustes.ts;
            patch.ajustesOk = ajustes.ts;
          } else {
            patch.ajustesOk = Math.max(ahora.ajustesOk, st.ajustesTs);
          }
          set(patch);
          if (pendientes(get().sessions).length > 0 && subir.length === 100) void get().sync();
        } catch {
          set({ syncState: "error", syncError: "Sin conexión. Se sincroniza cuando vuelva." });
        }
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
      storage: createJSONStorage(() => almacenSeguro),
      version: 3,
      // v2 guardaba un historial por día; ahora son sesiones sueltas (para poder sincronizarlas).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 3) {
          const h = (p.history ?? {}) as Record<string, Seconds>;
          p.sessions = Object.entries(h).map(([f, d]) => ({ id: "mig" + f.replace(/-/g, ""), f, d, p: 1 }));
          delete p.history;
        }
        return p as unknown as State;
      },
      // Lo guardado en el teléfono se revisa campo por campo: lo dañado o raro se descarta y se usa el valor normal (así la app siempre abre).
      merge: (persisted, current) => ({ ...current, ...sanear(persisted) }),
      partialize: (s) => ({
        minutes: s.minutes,
        blockMin: s.blockMin,
        sound: s.sound,
        lang: s.lang,
        areaNames: s.areaNames,
        sessions: s.sessions,
        session: s.session,
        ajustesTs: s.ajustesTs,
        ajustesOk: s.ajustesOk,
        auth: s.auth,
        lastSync: s.lastSync,
      }),
    },
  ),
);
