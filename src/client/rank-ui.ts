import { NAMES } from '../shared/names';
import { nextRankXp } from '../shared/progression';

/** The mochila line: "Rango 3 · 300/420 Savia" (at the top, just the total). */
export function rankLine(xp: number, rank: number): string {
  const next = nextRankXp(rank);
  return `${NAMES.rank} ${rank} · ${next === null ? xp : `${xp}/${next}`} ${NAMES.xp}`;
}

/** The card on a Rango up. */
export const rankUpText = (rank: number): string => `${NAMES.rank} ${rank}. Un punto de oficio.`;

/** Seconds the green flash stays on a robot that climbed a Rango. */
export const RANK_FLASH = 1.2;
