// Límite de intentos de contraseña, guardado en el almacén (sobrevive entre instancias de Vercel).
//  - Por IP: 5 intentos fallidos seguidos -> bloqueada 15 minutos.
//  - Global: 20 fallos entre todas las IPs en 15 minutos -> bloqueo de todos (se levanta solo).
// Cada intento se REGISTRA ANTES de comprobar la contraseña. Si el almacén falla, NO se deja pasar.
import { leer, escribir, crear, ConflictoError, ExisteError } from "./almacen";

export const RUTA = "timerpiano/intentos.json";
export const VENTANA = 15 * 60 * 1000;
export const MAX_IP = 5;
export const MAX_GLOBAL = 20;
const REINTENTOS = 25;

type Doc = { ips: Record<string, { n: number; hasta: number }>; global: { n: number; hasta: number } };
type Res = { permitido?: boolean; espera?: number; sinCambios?: boolean };

const vacio = (): Doc => ({ ips: {}, global: { n: 0, hasta: 0 } });

function depurar(d: Doc, ahora: number): Doc {
  for (const [ip, r] of Object.entries(d.ips)) if (r.hasta <= ahora) delete d.ips[ip];
  if (d.global.hasta <= ahora) d.global = { n: 0, hasta: 0 };
  const claves = Object.keys(d.ips);
  if (claves.length > 200) claves.sort((a, b) => d.ips[b].n - d.ips[a].n).slice(200).forEach((k) => delete d.ips[k]);
  return d;
}

async function modificar(cambiar: (d: Doc, ahora: number) => Res): Promise<Res> {
  for (let i = 0; i < REINTENTOS; i++) {
    const actual = await leer<Doc>(RUTA);
    const d = depurar(actual?.data ?? vacio(), Date.now());
    const res = cambiar(d, Date.now());
    if (res.sinCambios) return res;
    try {
      if (actual) await escribir(RUTA, d, { etag: actual.etag });
      else await crear(RUTA, d);
      return res;
    } catch (e) {
      if (!(e instanceof ConflictoError || e instanceof ExisteError)) throw e;
      await new Promise((r) => setTimeout(r, Math.random() * 30 * (i + 1)));
    }
  }
  throw new Error("no se pudo registrar el intento");
}

/** Registra un intento. { permitido: true } o { permitido: false, espera: segundos }. */
export const reservar = (ip: string) =>
  modificar((d, ahora) => {
    const r = d.ips[ip];
    if (r && r.n >= MAX_IP) return { permitido: false, espera: Math.ceil((r.hasta - ahora) / 1000), sinCambios: true };
    if (d.global.n >= MAX_GLOBAL)
      return { permitido: false, espera: Math.ceil((d.global.hasta - ahora) / 1000), sinCambios: true };
    d.ips[ip] = { n: (r?.n || 0) + 1, hasta: ahora + VENTANA };
    d.global = { n: d.global.n + 1, hasta: ahora + VENTANA };
    return { permitido: true };
  });

/** Contraseña correcta: se borra el registro de esa IP y se devuelve su intento al contador global. */
export const exito = (ip: string) =>
  modificar((d) => {
    if (!d.ips[ip]) return { sinCambios: true };
    delete d.ips[ip];
    d.global.n = Math.max(0, d.global.n - 1);
    return {};
  });
