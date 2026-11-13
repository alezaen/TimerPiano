"use client";

import type { AreaId } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: GainNode | null = null;

/** Impulso de reverb sintético: ruido que se apaga solo, suena a salita. */
function makeImpulse(c: AudioContext, seconds = 1.8, decay = 3): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function init(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);

    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx);
    reverb = ctx.createGain();
    reverb.gain.value = 0.28;
    reverb.connect(conv);
    conv.connect(comp);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Escala pentatónica de Do: todo lo que se toque al azar suena bien junto. */
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

type Voice = "piano" | "bell";

function note(freq: number, at: number, dur: number, vol: number, voice: Voice = "piano") {
  const c = init();
  const out = master!;
  const partials =
    voice === "piano"
      ? [
          { m: 1, g: 1, d: 1 },
          { m: 2, g: 0.42, d: 0.6 },
          { m: 3, g: 0.18, d: 0.4 },
          { m: 4.01, g: 0.08, d: 0.25 },
        ]
      : [
          { m: 1, g: 1, d: 1 },
          { m: 2.76, g: 0.35, d: 0.7 },
          { m: 5.4, g: 0.15, d: 0.4 },
        ];

  for (const p of partials) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq * p.m;
    const t = c.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * p.g, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * p.d);
    o.connect(g);
    g.connect(out);
    g.connect(reverb!);
    o.start(t);
    o.stop(t + dur * p.d + 0.05);
  }
}

/** Clic seco y corto, como un metrónomo de madera. */
function tick(freq: number, vol: number) {
  const c = init();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + 0.1);
}

/** Cada área tiene su "firma" de dos notas, así sabes a dónde vas sin mirar. */
const MOTIF: Record<AreaId, [number, number]> = {
  solfeo: [72, 79],
  hanon: [74, 81],
  oido: [76, 84],
  thompson: [79, 86],
};

export function requestAudioPermission() {
  init();
}

/** Nota de la pentatónica según el valor del contador (sube al sumar, baja al restar). */
export function playStep(step: number) {
  note(midi(PENTA[Math.max(0, Math.min(PENTA.length - 1, step % PENTA.length))]), 0, 0.5, 0.11);
}

export function playTap() {
  tick(1400, 0.07);
}

export function playShuffle() {
  const idx = Array.from({ length: 5 }, () => Math.floor(Math.random() * PENTA.length));
  idx.forEach((n, i) => note(midi(PENTA[n]), i * 0.055, 0.35, 0.08));
}

export function playStart() {
  [60, 67, 72, 76].forEach((n, i) => note(midi(n), i * 0.09, 1.1, 0.16));
}

export function playBlockStart(area: AreaId) {
  const [a, b] = MOTIF[area];
  note(midi(a), 0, 0.9, 0.17);
  note(midi(b), 0.14, 1.3, 0.17, "bell");
}

/** Cuenta atrás: 3, 2, 1 con tono que sube. */
export function playCountdown(n: number) {
  tick(900 + (4 - n) * 220, 0.1);
}

export function playPause() {
  note(midi(79), 0, 0.5, 0.12);
  note(midi(72), 0.1, 0.7, 0.12);
}

export function playResume() {
  note(midi(72), 0, 0.5, 0.12);
  note(midi(79), 0.1, 0.7, 0.12);
}

export function playSessionEnd() {
  [72, 76, 79, 84, 88].forEach((n, i) => note(midi(n), i * 0.11, 1.8, 0.15, "bell"));
  [60, 67, 76].forEach((n) => note(midi(n), 0.6, 2.6, 0.1));
}
