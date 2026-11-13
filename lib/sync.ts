import type { SessionRecord } from "./types";

export const MAX_SESSIONS = 1000;

/** Id de sesión: 12 caracteres a-z0-9 (el servidor exige ese formato). */
export const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");

/**
 * Une lo que dice el servidor con lo local: lo del servidor manda; lo que solo existe aquí
 * queda marcado como pendiente (p) para subirlo en la próxima sincronización.
 */
export function mezclar(local: SessionRecord[], servidor: SessionRecord[]): SessionRecord[] {
  const ids = new Set(servidor.map((s) => s.id));
  const limpias = servidor.map(({ id, f, d }) => ({ id, f, d }));
  const soloAqui = local.filter((s) => !ids.has(s.id)).map((s) => ({ ...s, p: 1 as const }));
  return [...limpias, ...soloAqui]
    .sort((a, b) => (a.f === b.f ? a.id.localeCompare(b.id) : a.f.localeCompare(b.f)))
    .slice(-MAX_SESSIONS);
}

export const pendientes = (sessions: SessionRecord[]) => sessions.filter((s) => s.p);
