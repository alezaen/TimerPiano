// POST /api/entrar  { clave } -> { ok, token, expira }   (único lugar donde se prueba la contraseña)
import { claveValida, crearToken, problemaConClave } from "@/lib/server/auth";
import { reservar, exito } from "@/lib/server/intentos";

export const dynamic = "force-dynamic";

const responder = (cuerpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store", ...extra } });

// En Vercel, x-vercel-forwarded-for lo pone la plataforma (el cliente no lo controla).
const ipDe = (r: Request) =>
  (r.headers.get("x-vercel-forwarded-for") || r.headers.get("x-forwarded-for") || "desconocida").split(",")[0].trim().slice(0, 64);

export async function POST(request: Request) {
  const problema = problemaConClave();
  if (problema) return responder({ error: problema }, 500);

  let cuerpo: { clave?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return responder({ error: "Solicitud inválida" }, 400);
  }
  if (!cuerpo || typeof cuerpo.clave !== "string" || cuerpo.clave.length > 200)
    return responder({ error: "Solicitud inválida" }, 400);

  const ip = ipDe(request);
  let cupo;
  try {
    cupo = await reservar(ip);
  } catch (e) {
    console.error("límite de intentos:", e);
    return responder({ error: "No se pudo comprobar el límite de intentos. Intenta de nuevo en un momento." }, 503);
  }
  if (!cupo.permitido) {
    const min = Math.max(1, Math.ceil((cupo.espera ?? 60) / 60));
    return responder({ error: `Demasiados intentos. Espera ${min} min.` }, 429, { "Retry-After": String(cupo.espera ?? 60) });
  }

  if (!claveValida(cuerpo.clave)) {
    await new Promise((r) => setTimeout(r, 1000)); // frena cada intento
    return responder({ error: "Contraseña incorrecta" }, 401);
  }
  try {
    await exito(ip);
  } catch (e) {
    console.error("no se pudo limpiar el contador:", e);
  }
  return responder({ ok: true, ...crearToken() });
}
