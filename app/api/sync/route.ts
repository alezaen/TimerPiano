// POST /api/sync { token, sesiones?, ajustes? } -> { sesiones, ajustes }
// Guarda en timerpiano/sync.json las sesiones nuevas (solo agrega; una sesión con el mismo id no se repite)
// y los ajustes más recientes (gana el de fecha mayor). Siempre devuelve lo que hay guardado.
import { leer, escribir, crear, ConflictoError, ExisteError } from "@/lib/server/almacen";
import { tokenValido, problemaConClave } from "@/lib/server/auth";
import { limpiarSesion, limpiarAjustes, MAX_SESIONES, type Ajustes } from "@/lib/server/validar";
import type { SessionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const RUTA = "timerpiano/sync.json";
const MAX_BYTES = 200_000;
const MAX_POR_ENVIO = 100;

type Doc = { version: 1; sesiones: SessionRecord[]; ajustes: Ajustes | null };

const responder = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

async function aplicar(nuevas: SessionRecord[], ajustes: Ajustes | null): Promise<Doc | null> {
  for (let i = 0; i < 12; i++) {
    const actual = await leer<Doc>(RUTA);
    const doc: Doc =
      actual && Array.isArray(actual.data?.sesiones)
        ? { version: 1, sesiones: actual.data.sesiones, ajustes: actual.data.ajustes ?? null }
        : { version: 1, sesiones: [], ajustes: null };

    const ids = new Set(doc.sesiones.map((s) => s.id));
    const frescas = nuevas.filter((s) => !ids.has(s.id));
    let cambio = false;
    if (frescas.length) {
      doc.sesiones = [...doc.sesiones, ...frescas].slice(-MAX_SESIONES);
      cambio = true;
    }
    if (ajustes && ajustes.ts > (doc.ajustes?.ts ?? 0)) {
      doc.ajustes = ajustes;
      cambio = true;
    }
    if (!cambio) return doc;

    try {
      if (actual) await escribir(RUTA, doc, { etag: actual.etag });
      else await crear(RUTA, doc);
      return doc;
    } catch (e) {
      if (e instanceof ConflictoError || e instanceof ExisteError) continue;
      throw e;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const problema = problemaConClave();
  if (problema) return responder({ error: problema }, 500);

  let cuerpo: { token?: unknown; sesiones?: unknown; ajustes?: unknown };
  try {
    const bruto = await request.text();
    if (bruto.length > MAX_BYTES) return responder({ error: "Los datos son demasiado grandes" }, 413);
    cuerpo = JSON.parse(bruto);
  } catch {
    return responder({ error: "Solicitud inválida" }, 400);
  }
  if (!cuerpo || typeof cuerpo !== "object") return responder({ error: "Solicitud inválida" }, 400);
  if (!tokenValido(cuerpo.token)) return responder({ error: "Sesión no válida o vencida" }, 401);

  let nuevas: SessionRecord[] = [];
  if (cuerpo.sesiones !== undefined) {
    if (!Array.isArray(cuerpo.sesiones) || cuerpo.sesiones.length > MAX_POR_ENVIO)
      return responder({ error: `Envía hasta ${MAX_POR_ENVIO} sesiones.` }, 400);
    const limpias = cuerpo.sesiones.map(limpiarSesion);
    if (limpias.some((s) => !s)) return responder({ error: "Alguna sesión no es válida." }, 400);
    nuevas = limpias as SessionRecord[];
  }
  const ajustes = cuerpo.ajustes === undefined || cuerpo.ajustes === null ? null : limpiarAjustes(cuerpo.ajustes);
  // Un ajuste con fecha 0 (dispositivo recién estrenado, sin cambios) simplemente no se guarda.
  const ajustesEnviados = (cuerpo.ajustes as { ts?: unknown } | null | undefined)?.ts;
  if (cuerpo.ajustes && ajustesEnviados !== 0 && !ajustes) return responder({ error: "Ajustes no válidos." }, 400);

  try {
    const doc = await aplicar(nuevas, ajustes);
    if (!doc) return responder({ error: "Hubo cambios al mismo tiempo. Intenta de nuevo." }, 409);
    return responder({ sesiones: doc.sesiones, ajustes: doc.ajustes });
  } catch (e) {
    console.error("POST /api/sync:", e);
    return responder({ error: "No se pudo sincronizar. Intenta de nuevo." }, 500);
  }
}
