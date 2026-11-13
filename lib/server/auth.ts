// Acceso de un solo usuario (tú). Misma idea que Acordes y Tonos:
// la contraseña (ADMIN_PASSWORD, en Vercel) solo se comprueba en /api/entrar. Si es correcta, el servidor
// entrega un "pase" firmado que vence a los 30 días; el teléfono/PC guarda el pase, nunca la contraseña.
// La firma usa SESSION_SECRET (texto aleatorio largo, también en Vercel). Cambiar cualquiera de las dos
// variables invalida todos los pases.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MIN_CLAVE = 12;
export const MIN_SECRETO = 32;
const DIAS = 30;

const hash = (s: unknown) => createHash("sha256").update(String(s ?? "")).digest();

const llave = () => hash("timerpiano-sesion-v1|" + process.env.SESSION_SECRET);
const firmar = (exp: number | string) => createHmac("sha256", llave()).update("v1." + exp).digest("hex");

/** Compara en tiempo constante (sin revelar cuántas letras acertó). */
export const claveValida = (intento: string) => timingSafeEqual(hash(intento), hash(process.env.ADMIN_PASSWORD));

export function crearToken() {
  const exp = Date.now() + DIAS * 864e5;
  return { token: `v1.${exp}.${firmar(exp)}`, expira: exp };
}

export function tokenValido(t: unknown): boolean {
  const m = /^v1\.(\d{10,15})\.([0-9a-f]{64})$/.exec(String(t ?? ""));
  if (!m || Number(m[1]) < Date.now()) return false;
  return timingSafeEqual(Buffer.from(m[2], "hex"), Buffer.from(firmar(m[1]), "hex"));
}

/** Texto de error si la configuración del servidor falta o es insegura; si está bien, null. */
export function problemaConClave(): string | null {
  const c = process.env.ADMIN_PASSWORD;
  const s = process.env.SESSION_SECRET;
  if (!c) return "Falta la variable ADMIN_PASSWORD en Vercel";
  if (c.length < MIN_CLAVE) return `ADMIN_PASSWORD en Vercel es demasiado corta (mínimo ${MIN_CLAVE} caracteres)`;
  if (!s) return "Falta la variable SESSION_SECRET en Vercel";
  if (s.length < MIN_SECRETO) return `SESSION_SECRET en Vercel es demasiado corta (mínimo ${MIN_SECRETO} caracteres)`;
  return null;
}
