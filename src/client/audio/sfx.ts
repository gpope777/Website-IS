/** P7-B (spec §4.2): every effect is one row of numbers. Retune here. */
import type { SfxDef } from './synth';

export type Bus = 'sfx' | 'ui' | 'ambient' | 'music';
export type VoiceClass = 'step' | 'hit' | 'tell' | 'ui' | 'world';
export interface SfxEntry extends SfxDef { bus: Bus; cls: VoiceClass; tell?: true }

const step = (freq: number, lp: number, extra: Partial<SfxDef> = {}): SfxEntry => ({ wave: 'noise', freq, attack: 0.005, sustain: 0.02, decay: 0.08, vol: 0.35, lp, bus: 'sfx', cls: 'step', ...extra });

export const SFX = {
  // Jugador
  'paso-hierba': step(3000, 1800),
  'paso-arena': step(5000, 2600, { decay: 0.1, vol: 0.3 }),
  'paso-roca': step(1200, 1400, { decay: 0.05, vol: 0.4, hp: 300 }),
  'paso-nieve': step(2500, 1200, { decay: 0.14, vol: 0.3 }),
  'paso-agua': step(900, 900, { decay: 0.18, vol: 0.35, trem: 25 }),
  salto: { wave: 'tri', freq: 220, slide: 2, attack: 0.01, sustain: 0.04, decay: 0.08, vol: 0.3, lp: 2000, bus: 'sfx', cls: 'world' },
  aterrizaje: { wave: 'noise', freq: 400, attack: 0.003, sustain: 0.03, decay: 0.12, vol: 0.5, lp: 600, bus: 'sfx', cls: 'world' },
  rodar: { wave: 'noise', freq: 1500, slide: -1.5, attack: 0.03, sustain: 0.15, decay: 0.15, vol: 0.4, lp: 1200, bus: 'sfx', cls: 'world' },
  'golpe-aire': { wave: 'noise', freq: 4000, slide: -2, attack: 0.02, sustain: 0.04, decay: 0.1, vol: 0.35, lp: 3000, hp: 400, bus: 'sfx', cls: 'hit' },
  golpe: { wave: 'square', freq: 140, slide: -3, attack: 0.002, sustain: 0.03, decay: 0.12, vol: 0.6, lp: 1400, noise: 0.5, bus: 'sfx', cls: 'hit' },
  'golpe-final': { wave: 'square', freq: 110, slide: -3, attack: 0.002, sustain: 0.06, decay: 0.3, vol: 0.75, lp: 1200, noise: 0.5, echo: 0.09, bus: 'sfx', cls: 'hit' },
  'arco-tensar': { wave: 'saw', freq: 180, slide: 1.2, attack: 0.1, sustain: 0.15, decay: 0.05, vol: 0.2, lp: 900, bus: 'sfx', cls: 'world' },
  'arco-soltar': { wave: 'noise', freq: 6000, slide: -3, attack: 0.002, sustain: 0.03, decay: 0.12, vol: 0.4, lp: 5000, hp: 800, bus: 'sfx', cls: 'hit' },
  'flecha-clava': { wave: 'tri', freq: 320, slide: -4, attack: 0.001, sustain: 0.02, decay: 0.08, vol: 0.5, noise: 0.3, lp: 2500, bus: 'sfx', cls: 'hit' },
  bloqueo: { wave: 'square', freq: 260, attack: 0.002, sustain: 0.02, decay: 0.1, vol: 0.5, lp: 1800, noise: 0.3, bus: 'sfx', cls: 'hit' },
  parada: { wave: 'sine', freq: 1760, chord: [1.5, 2.76], attack: 0.001, sustain: 0.03, decay: 0.4, vol: 0.6, trem: 30, bus: 'sfx', cls: 'hit' },
  dano: { wave: 'saw', freq: 200, slide: -2, attack: 0.002, sustain: 0.05, decay: 0.15, vol: 0.55, lp: 900, noise: 0.4, bus: 'sfx', cls: 'hit' },
  caer: { wave: 'saw', freq: 300, slide: -3, attack: 0.01, sustain: 0.2, decay: 0.35, vol: 0.5, lp: 800, bus: 'sfx', cls: 'world' },
  levantarse: { wave: 'tri', freq: 330, chord: [1.25, 1.5], attack: 0.05, sustain: 0.15, decay: 0.3, vol: 0.4, bus: 'ui', cls: 'ui' },
  planeador: { wave: 'noise', freq: 2000, slide: 1, attack: 0.15, sustain: 0.2, decay: 0.2, vol: 0.35, lp: 1500, hp: 300, bus: 'sfx', cls: 'world' },
  trepar: { wave: 'noise', freq: 1800, attack: 0.002, sustain: 0.02, decay: 0.05, vol: 0.35, lp: 2200, hp: 500, bus: 'sfx', cls: 'step' },
  nadar: { wave: 'noise', freq: 700, slide: 1, attack: 0.05, sustain: 0.08, decay: 0.2, vol: 0.35, lp: 1000, trem: 12, bus: 'sfx', cls: 'step' },
  tobogan: { wave: 'noise', freq: 3000, attack: 0.05, sustain: 0.3, decay: 0.2, vol: 0.3, lp: 2500, hp: 600, bus: 'sfx', cls: 'world' },
  // Poderes
  enredadera: { wave: 'saw', freq: 90, slide: 1.5, attack: 0.05, sustain: 0.25, decay: 0.2, vol: 0.5, lp: 700, noise: 0.35, trem: 18, bus: 'sfx', cls: 'world' },
  viento: { wave: 'noise', freq: 3000, slide: -1, attack: 0.08, sustain: 0.2, decay: 0.3, vol: 0.5, lp: 1800, hp: 200, bus: 'sfx', cls: 'world' },
  fuego: { wave: 'noise', freq: 900, attack: 0.02, sustain: 0.3, decay: 0.25, vol: 0.6, lp: 1600, trem: 22, bus: 'sfx', cls: 'world' },
  piedra: { wave: 'sine', freq: 70, slide: -1.5, attack: 0.002, sustain: 0.1, decay: 0.4, vol: 0.8, noise: 0.45, lp: 500, bus: 'sfx', cls: 'world' },
  // Mundo
  talar: { wave: 'square', freq: 180, slide: -2, attack: 0.001, sustain: 0.02, decay: 0.12, vol: 0.5, lp: 1100, noise: 0.5, bus: 'sfx', cls: 'world' },
  picar: { wave: 'sine', freq: 1300, chord: [2.1], attack: 0.001, sustain: 0.01, decay: 0.15, vol: 0.45, noise: 0.25, bus: 'sfx', cls: 'world' },
  bayas: { wave: 'sine', freq: 600, slide: 2, attack: 0.005, sustain: 0.03, decay: 0.06, vol: 0.35, bus: 'sfx', cls: 'world' },
  construir: { wave: 'square', freq: 220, attack: 0.002, sustain: 0.03, decay: 0.12, vol: 0.45, lp: 900, noise: 0.4, echo: 0.12, bus: 'sfx', cls: 'world' },
  'muro-roto': { wave: 'noise', freq: 300, slide: -1, attack: 0.002, sustain: 0.1, decay: 0.4, vol: 0.7, lp: 900, bus: 'sfx', cls: 'world' },
  cofre: { wave: 'tri', freq: 523, chord: [1.26, 1.5, 2], attack: 0.01, sustain: 0.1, decay: 0.35, vol: 0.4, bus: 'ui', cls: 'ui' },
  orbe: { wave: 'sine', freq: 660, slide: 1.5, attack: 0.01, sustain: 0.2, decay: 0.35, vol: 0.45, trem: 9, chord: [2], bus: 'ui', cls: 'ui' },
  'zona-limpia': { wave: 'tri', freq: 262, chord: [1.26, 1.5, 2], attack: 0.1, sustain: 0.2, decay: 0.3, vol: 0.45, vib: 5, bus: 'ui', cls: 'ui' },
  fogata: { wave: 'noise', freq: 1200, slide: 0.5, attack: 0.05, sustain: 0.2, decay: 0.3, vol: 0.45, lp: 1400, trem: 16, bus: 'sfx', cls: 'world' },
  viaje: { wave: 'sine', freq: 330, slide: 2.5, attack: 0.1, sustain: 0.2, decay: 0.25, vol: 0.35, vib: 7, chord: [1.5], bus: 'ui', cls: 'ui' },
  trueno: { wave: 'noise', freq: 60, attack: 0.02, sustain: 0.15, decay: 0.43, vol: 0.8, lp: 300, bus: 'ambient', cls: 'world' },
  // Enemigos (avisos: siempre se oyen)
  'lobo-aviso': { wave: 'saw', freq: 95, slide: 0.8, attack: 0.02, sustain: 0.15, decay: 0.1, vol: 0.7, lp: 700, noise: 0.35, trem: 28, bus: 'sfx', cls: 'tell', tell: true },
  'bruto-carga': { wave: 'saw', freq: 60, slide: 1.2, attack: 0.05, sustain: 0.25, decay: 0.15, vol: 0.8, lp: 500, noise: 0.3, bus: 'sfx', cls: 'tell', tell: true },
  'rayo-zumbido': { wave: 'square', freq: 220, slide: 2, attack: 0.05, sustain: 0.3, decay: 0.1, vol: 0.45, lp: 2500, trem: 40, bus: 'sfx', cls: 'tell', tell: true },
  'jefe-aviso': { wave: 'saw', freq: 110, chord: [1.06, 1.5], attack: 0.05, sustain: 0.25, decay: 0.2, vol: 0.7, lp: 1200, trem: 8, bus: 'sfx', cls: 'tell', tell: true },
  papel: { wave: 'noise', freq: 7000, attack: 0.03, sustain: 0.08, decay: 0.12, vol: 0.3, lp: 6000, hp: 1500, trem: 35, bus: 'sfx', cls: 'world' },
  // Monturas
  'doma-tic': { wave: 'sine', freq: 880, attack: 0.001, sustain: 0.01, decay: 0.05, vol: 0.35, bus: 'ui', cls: 'ui' },
  'doma-bien': { wave: 'tri', freq: 660, slide: 1, attack: 0.005, sustain: 0.05, decay: 0.12, vol: 0.4, bus: 'ui', cls: 'ui' },
  'doma-mal': { wave: 'square', freq: 160, slide: -1, attack: 0.005, sustain: 0.06, decay: 0.12, vol: 0.35, lp: 900, bus: 'ui', cls: 'ui' },
  galope: { wave: 'noise', freq: 500, attack: 0.002, sustain: 0.02, decay: 0.07, vol: 0.45, lp: 700, echo: 0.11, bus: 'sfx', cls: 'step' },
  // UI
  boton: { wave: 'sine', freq: 1000, attack: 0.001, sustain: 0.01, decay: 0.04, vol: 0.25, bus: 'ui', cls: 'ui' },
  menu: { wave: 'tri', freq: 520, slide: 0.8, attack: 0.005, sustain: 0.03, decay: 0.08, vol: 0.3, bus: 'ui', cls: 'ui' },
  toast: { wave: 'sine', freq: 740, chord: [1.5], attack: 0.005, sustain: 0.03, decay: 0.12, vol: 0.25, bus: 'ui', cls: 'ui' },
  rango: { wave: 'tri', freq: 392, chord: [1.26, 1.5, 2], slide: 0.4, attack: 0.02, sustain: 0.2, decay: 0.35, vol: 0.45, bus: 'ui', cls: 'ui' },
  proeza: { wave: 'sine', freq: 784, chord: [1.26, 1.5], attack: 0.01, sustain: 0.15, decay: 0.3, vol: 0.4, echo: 0.1, bus: 'ui', cls: 'ui' },
  venta: { wave: 'sine', freq: 1320, chord: [1.5], attack: 0.001, sustain: 0.02, decay: 0.15, vol: 0.35, echo: 0.07, bus: 'ui', cls: 'ui' },
  no: { wave: 'square', freq: 120, attack: 0.005, sustain: 0.05, decay: 0.06, vol: 0.3, lp: 500, bus: 'ui', cls: 'ui' },
  // Avisos
  cuerno: { wave: 'saw', freq: 147, vib: 4, attack: 0.1, sustain: 0.3, decay: 0.2, vol: 0.6, lp: 1000, chord: [1.5], bus: 'sfx', cls: 'tell', tell: true },
  marchito: { wave: 'saw', freq: 98, chord: [1.06, 1.41, 1.89], attack: 0.1, sustain: 0.25, decay: 0.25, vol: 0.6, lp: 1400, vib: 6, bus: 'sfx', cls: 'tell', tell: true },
  latido: { wave: 'sine', freq: 55, attack: 0.005, sustain: 0.03, decay: 0.12, vol: 0.6, echo: 0.18, lp: 300, bus: 'ui', cls: 'ui' },
} satisfies Record<string, SfxEntry>;

export type SfxId = keyof typeof SFX;
export const SFX_IDS = Object.keys(SFX) as SfxId[];
