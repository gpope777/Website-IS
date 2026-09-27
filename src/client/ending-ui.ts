import { ENDING, GUARDIAN_LINES, guardianSpot } from '../shared/ending';
import { NAMES } from '../shared/names';

/** One step of the ending's sequence: a vision card (5 s) or the scrolling credits (25 s). */
export interface EndingStep {
  lines: string[];
  ms: number;
  credits: boolean;
}

/** The long vision one card at a time, then the credits (✕ / Enter skips a step). */
export function endingSteps(cards: readonly string[], credits: readonly string[]): EndingStep[] {
  return [...cards.map((c) => ({ lines: [c], ms: ENDING.cardFor * 1000, credits: false })), ...(credits.length ? [{ lines: [...credits], ms: ENDING.creditsFor * 1000, credits: true }] : [])];
}

/** A / E near el Guardián after the ending (client-only: his lines are hints, nothing to validate). */
export function guardianAction(pos: { x: number; z: number }, heart: { x: number; z: number } | null, ending: boolean): { label: string } | null {
  if (!ending || !heart) return null;
  const g = guardianSpot(heart);
  return Math.hypot(g.x - pos.x, g.z - pos.z) <= ENDING.guardian.reach ? { label: `Hablar con ${NAMES.guardian}` } : null;
}

/** His next line (they cycle). */
export function guardianLine(i: number): string {
  return GUARDIAN_LINES[((i % GUARDIAN_LINES.length) + GUARDIAN_LINES.length) % GUARDIAN_LINES.length]!;
}

/** The Menú's raids toggle: only at the Heart after the ending. `on` is what the click asks for. */
export function raidsMenu(ending: boolean, atHeart: boolean, off: boolean): { label: string; on: boolean } | null {
  if (!ending || !atHeart) return null;
  return { label: `${NAMES.raidNights}: ${off ? 'apagadas' : 'encendidas'}`, on: off };
}
