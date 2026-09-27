import { NAMES } from './names';
import { MOUNTAINS, HALF, CORRUPT_LANDS, inCorrupt, type Terrain } from './terrain';
import type { CallBeast, EnemyKind } from './protocol';

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

/**
 * La Grieta (S5-G, spec §3/§10.2): after the ending, a 6 m notch at x = 0 cut through el Borde at 30°, from the
 * rim's foot in la Ceniza south into the mountains until it meets the ground. Walkers cross the rim line in it.
 */
export const GRIETA = { half: 3, deg: 30, len: 110 } as const;
const GRIETA_FOOT = CORRUPT_LANDS.z1 - CORRUPT_LANDS.rim;

/** Inside the Grieta's band (the notch may be shallower than the band: see `withGrieta`). */
export function inGrieta(x: number, z: number): boolean {
  return Math.abs(x) < GRIETA.half && z >= GRIETA_FOOT && z <= GRIETA_FOOT + GRIETA.len;
}

/** The terrain with la Grieta cut while `open()`: in the band, min(ground, foot + tan 30° · metres south of the foot). */
export function withGrieta(base: Terrain, open: () => boolean): Terrain {
  let foot: number | null = null;
  const slope = Math.tan((GRIETA.deg * Math.PI) / 180);
  return {
    heightAt: (x, z) => {
      const h = base.heightAt(x, z);
      if (!open() || !inGrieta(x, z)) return h;
      foot ??= base.heightAt(0, GRIETA_FOOT);
      return Math.min(h, foot + slope * (z - GRIETA_FOOT));
    },
    density: (x, z) => base.density(x, z),
    ...(base.waterAt ? { waterAt: (x: number, z: number) => base.waterAt!(x, z) } : {}),
  };
}

/** A ground move crossing the rim northward; with la Grieta open (`grieta`), a move into its band (`nx`) passes. */
export function rimCrossBlocked(pz: number, nz: number, nx?: number, grieta = false): boolean {
  if (grieta && nx !== undefined && Math.abs(nx) < GRIETA.half) return false;
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

/** Where a called mount lands (spec S5 §4): the deer 3 m west of the Ceniza ring, the frog 3 m north, the fish in the Lago Negro's middle. */
export function callSpot(beast: CallBeast, fogata: { x: number; z: number }, lake: { x: number; z: number }): { x: number; z: number } {
  if (beast === 'fish') return { x: lake.x, z: lake.z };
  return beast === 'deer' ? { x: fogata.x - 3, z: fogata.z } : { x: fogata.x, z: fogata.z - 3 };
}

export const CALL_TEXT: Record<CallBeast, string> = {
  deer: 'Silbas. Tu ciervo llega trotando por la ceniza',
  frog: 'Silbas. Tu rana cae del cielo, más o menos',
  fish: `Silbas. Tu pez ya espera en ${NAMES.blackLake}`,
};
export const CALL_NONE: Record<CallBeast, string> = { deer: 'No tienes ciervo', frog: 'No tienes rana', fish: 'No tienes pez' };
