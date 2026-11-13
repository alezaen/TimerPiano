// Acceso al almacén (Vercel Blob). Mismo diseño que Acordes y Tonos.
//  - leer(ruta)                -> { data, etag } o null si no existe
//  - escribir(ruta, data, { etag }) -> solo si nadie lo cambió desde que lo leíste (si no: ConflictoError)
//  - crear(ruta, data)         -> solo si NO existe (si ya existe: ExisteError)
import { get, put, head, BlobPreconditionFailedError } from "@vercel/blob";

export class ConflictoError extends Error {}
export class ExisteError extends Error {}

type Acceso = "private" | "public";
// Según cómo se creó el almacén, el acceso es "private" o "public": se prueba en ese orden y se recuerda el que funcionó.
let preferido: Acceso = "private";
async function conAcceso<T>(operacion: (a: Acceso) => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (const access of (preferido === "private" ? ["private", "public"] : ["public", "private"]) as Acceso[]) {
    try {
      const r = await operacion(access);
      preferido = access;
      return r;
    } catch (e) {
      ultimo = e;
      if (e instanceof BlobPreconditionFailedError) throw e;
    }
  }
  throw ultimo;
}

const sinFormato = (e: unknown) =>
  String(e || "").replace(/^W\//, "").replace(/"/g, "").replace(/-(gzip|br)$/, "");

export async function leer<T = unknown>(ruta: string): Promise<{ data: T; etag: string } | null> {
  let etagApi: string | null = null;
  try {
    etagApi = (await head(ruta)).etag || null;
  } catch {
    etagApi = null;
  }
  const r = await conAcceso((access) => get(ruta, { access, useCache: false }));
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const etagGet = r.blob.etag;
  const etag = etagApi && sinFormato(etagApi) === sinFormato(etagGet) ? etagApi : etagGet;
  return { data: JSON.parse(await new Response(r.stream).text()) as T, etag };
}

async function poner(ruta: string, data: unknown, extra: Record<string, unknown>, soloSiNoExiste = false) {
  try {
    return await conAcceso((access) =>
      put(ruta, JSON.stringify(data), {
        access,
        contentType: "application/json",
        addRandomSuffix: false,
        ...extra,
      }),
    );
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new ConflictoError("conflicto");
    if (soloSiNoExiste) {
      let hay = false;
      try {
        hay = Boolean(await leer(ruta));
      } catch {
        /* nada */
      }
      if (hay) throw new ExisteError("existe");
    }
    throw e;
  }
}

export const escribir = (ruta: string, data: unknown, { etag }: { etag?: string } = {}) =>
  poner(ruta, data, etag ? { ifMatch: etag } : { allowOverwrite: true });

export const crear = (ruta: string, data: unknown) => poner(ruta, data, { allowOverwrite: false }, true);
