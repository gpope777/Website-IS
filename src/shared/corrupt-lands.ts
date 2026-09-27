import { NAMES } from './names';
import { MOUNTAINS, HALF } from './terrain';

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
