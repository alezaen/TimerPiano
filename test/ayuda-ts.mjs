// Carga los archivos de lib/*.ts en las pruebas sin compilar la app: se pasan a JavaScript con TypeScript (que ya está en devDependencies)
// y se dejan en node_modules/.cache/timerpiano-pruebas (así encuentran zustand y compañía).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import ts from 'typescript';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SALIDA = join(RAIZ, 'node_modules', '.cache', 'timerpiano-pruebas');
const hechos = new Map();

async function compilar(rel) {
  const origen = join(RAIZ, rel), destino = join(SALIDA, rel.replace(/\.ts$/, '.mjs'));
  const codigo = await readFile(origen, 'utf8');
  let js = ts.transpileModule(codigo, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve } }).outputText;
  const deps = [];
  js = js.replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (_, a, ruta, c) => { deps.push(join(dirname(rel), ruta + '.ts')); return a + ruta + '.mjs' + c; });
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, js);
  for (const d of deps) if (!hechos.has(d)) hechos.set(d, compilar(d));
  await Promise.all(deps.map(d => hechos.get(d)));
  return destino;
}
/** cargarLib('lib/stats.ts') -> el módulo ya listo para usar. Cada llamada vuelve a leer el archivo (módulo nuevo), útil para estado limpio. */
export async function cargarLib(rel, { fresco = false } = {}) {
  hechos.clear();
  const destino = await compilar(rel);
  return import(pathToFileURL(destino).href + (fresco ? '?v=' + Math.random() : ''));
}
