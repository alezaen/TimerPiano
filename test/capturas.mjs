// Capturas de las pantallas de TimerPiano a 360 px de ancho, en claro y oscuro, con un navegador real sin pantalla. Avisa si algo se sale del ancho.
// Las imágenes quedan en capturas/ (míralas tú: la prueba detecta cortes, no belleza).   Ejecutar: npm run test:capturas   (requiere Playwright, ver test/recorridos.mjs)
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { arrancar, hacerSesion, ponerMinutos, revisarCortes, RAIZ, ANCHO } from './ayuda-navegador.mjs';

const SALIDA = join(RAIZ, 'capturas'); await mkdir(SALIDA, { recursive: true });
const app = await arrancar(), problemas = [];
const PASOS = [
  ['inicio', async p => {}],
  ['inicio-abajo', async p => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); }],
  ['sincronizar', async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.getByRole('button', { name: /sincroniz/i }).first().click(); await p.waitForTimeout(400); }],
  ['en-curso', async p => { await p.keyboard.press('Escape'); await p.reload(); await ponerMinutos(p, 'Solfeo', 5); await ponerMinutos(p, 'Hanon', 5); await ponerMinutos(p, 'Canción a oído', 0); await ponerMinutos(p, 'John Thompson', 0); await p.getByRole('button', { name: /Empezar · 10 min/ }).click(); await p.clock.runFor(2500); }],
  ['en-pausa', async p => { await p.getByRole('button', { name: 'Pausar' }).last().click(); await p.waitForTimeout(300); }],
  ['terminar-sesion', async p => { await p.getByRole('button', { name: 'Terminar sesión' }).click(); await p.waitForTimeout(200); }],
  ['sesion-guardada', async p => { await p.getByRole('button', { name: 'No', exact: true }).click(); await p.getByRole('button', { name: 'Seguir' }).last().click(); await p.clock.fastForward(700000); await p.getByText('Sesión guardada').waitFor(); await p.waitForTimeout(1500); }],
  ['inicio-con-historial', async p => { await p.getByRole('button', { name: 'Volver al inicio' }).click(); await p.getByRole('button', { name: /Empezar/ }).waitFor(); await p.waitForTimeout(800); }]
];
for (const tema of ['claro', 'oscuro']) {
  const { pagina } = await app.telefono({ tema, hora: new Date('2026-11-17T00:00:00Z') }), p = await pagina();
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor(); await p.waitForTimeout(500);
  for (const [nombre, paso] of PASOS) {
    try { await paso(p); await p.waitForTimeout(250); } catch (e) { problemas.push(`[${tema}] ${nombre}: no se pudo llegar (${e.message.split('\n')[0]})`); await p.screenshot({ path: join(SALIDA, `${tema}-ERROR-${nombre}.png`) }).catch(() => {}); continue; }
    const cortes = await p.evaluate(revisarCortes);
    await p.screenshot({ path: join(SALIDA, `${tema}-${nombre}.png`) });
    cortes.forEach(c => problemas.push(`[${tema}] ${nombre}: ${c}`)); console.log(`${cortes.length ? '✗' : '✓'} ${tema} · ${nombre}`);
  }
  p.errores.forEach(e => problemas.push(`[${tema}] ${e}`));
}
await app.cerrar();
console.log(`\nCapturas en ${SALIDA} (${ANCHO} px de ancho).`);
if (problemas.length) { console.error('\nPROBLEMAS:\n' + problemas.join('\n')); process.exit(1); }
console.log('Nada se sale del ancho y no hubo errores en la página.'); process.exit(0);
