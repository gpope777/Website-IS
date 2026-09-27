import { NAMES } from './names';
import { MOUNTAINS, HALF, CORRUPT_LANDS, inCorrupt, type Terrain } from './terrain';
import type { EnemyKind } from './protocol';

/**
 * Las Tierras Corruptas (spec S5 §3): the rules that are not terrain. The rim line is the old muro de niebla (S4-G):
 * nobody crosses it northward except flying. After the ending, la Grieta (S5-G) opens a gap for walkers.
 */
export const RIM_LINE = -HALF - MOUNTAINS.rimFrom;

/** A ground (or land-mount, swimming, gliding) move crossing the rim line northward. Flying never asks. */
/** El Marchito's tower (spec S5 §3.3): on la Torre's plateau, 60 m on its first day, +1 m a day, up to 140. */
export const TOWER = { x: 0, z: -HALF - 400, base: 60, grow: 1, max: 140, r: 14 } as const;

export function towerHeight(day: number, day0: number): number {
  return Math.min(TOWER.max, TOWER.base + TOWER.grow * Math.max(0, day - day0));
}

/** The first Raíz-madre still unpurified (Bosque → Costa → Pantano → Montaña), by name; null when all four are. */
export function missingRoot(w: { purified: boolean; purified2: boolean; purified3: boolean; purified4: boolean }): string | null {
  if (!w.purified) return `${NAMES.forestRoot} del Bosque`;
  if (!w.purified2) return NAMES.coastRoot;
  if (!w.purified3) return NAMES.swampRoot;
  if (!w.purified4) return NAMES.mountainRoot;
  return null;
}

/** The Tierras' north edge: the end of the world. */
export const FOG_EDGE_TEXT = 'La niebla te devuelve. Ahí no hay nada';

export const fogText = (missing: string) => `La niebla aguanta. Falta la ${missing}`;

export function rimCrossBlocked(pz: number, nz: number): boolean {
  return pz >= RIM_LINE && nz < RIM_LINE;
}

/** Day beasts of the Espinar (spec S5 §7.2–7.3): 6 ash beasts (1 brute) and 2–4 rayos, once a game day while someone is up here. */
export const ASH = { beasts: 6, brutes: 1, rayosMin: 2, rayosMax: 4, rayoCap: 8, dMin: 85, dMax: 165, rayoDrop: 0.5 } as const;

/** Black thorns for a kill: wolves and brutes in the Tierras always drop one; a rayo half the time (`roll` in [0, 1)). */
export function thornDrop(kind: EnemyKind, x: number, z: number, roll: number): number {
  if (kind === 'rayo') return roll < ASH.rayoDrop ? 1 : 0;
  return (kind === 'wolf' || kind === 'brute') && inCorrupt(x, z) ? 1 : 0;
}

/** Fogata 6 (spec S5 §7.1): a stone ring on la Ceniza, 50 m past the rim, a little east of the middle. */
export const CENIZA_FOGATA = { x: 24, d: 50 } as const;

export function cenizaFogata(t: Terrain): { x: number; z: number; y: number } {
  const z = CORRUPT_LANDS.z1 - CENIZA_FOGATA.d;
  return { x: CENIZA_FOGATA.x, z, y: t.heightAt(CENIZA_FOGATA.x, z) };
}
