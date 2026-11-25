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

/**
 * POST con JSON y tiempo máximo. Sin esto, una conexión que se queda colgada (señal mala en el teléfono) dejaba la
 * sincronización en "sincronizando" para siempre y no volvía a intentar hasta recargar la app.
 * Si se pasa el tiempo, se cancela y lanza un error (la app lo muestra como "sin conexión" y reintenta después).
 */
export async function postJson(
  url: string,
  body: unknown,
  ms = 20000,
  f: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await f(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}
