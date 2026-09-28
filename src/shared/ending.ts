import { NAMES } from './names';
import { joinNames } from './sim/marchito';
import { TOWER } from './corrupt-lands';
import type { Terrain } from './terrain';

/**
 * The ending (spec S5 §10, S5-G): the long vision, the credits, el Guardián by the Heart and the post-ending raids.
 * La Grieta lives in corrupt-lands.ts (next to the rim rule it opens).
 */
export const ENDING = {
  /** Seconds per vision card, and for the scrolling credits. */
  cardFor: 5,
  creditsFor: 25,
  /** [D] Override (orchestrator): raids go on after the ending at this share of the wave, no lieutenants. */
  raidMult: 0.6,
  /** El Guardián: `dx` m east of the Heart, a `h` m paper; A within `reach` talks. */
  guardian: { dx: 8, h: 3, reach: 3 },
  /** Everyone in the Torre is put this far from the Heart. */
  home: 4,
} as const;

const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The long vision: four cards. */
export function endingCards(names: string): string[] {
  return [
    `${NAMES.villain} se encoge. Las raíces se sueltan de la Copa una a una.`,
    `${up(NAMES.blackHeart)} se agrieta. Dentro no hay nada negro: hay savia.`,
    `«Yo también era un bosque… ${names}.»`,
    `Donde estaba él queda algo pequeño, marrón y con hojas en la cabeza. Sonríe. Es ${NAMES.guardian}.`,
  ];
}

/** The credits card, top to bottom. */
export function creditLines(names: string): string[] {
  return [NAMES.game, names, `Dibujos: ${NAMES.credits}`, `Hecho por ${NAMES.maker}`, 'Gracias por jugar'];
}

/** What someone who wasn't online sees on their first login after (`names`: who was in the Copa; empty for old saves). */
export function lateCards(names: readonly string[]): string[] {
  const first = names.length ? `Mientras dormías, ${joinNames(names)} ${names.length > 1 ? 'vencieron' : 'venció'} a ${NAMES.villain}.` : `${NAMES.villain} ya no está. Lo vencisteis vosotros.`;
  return [first, `${up(NAMES.villainTower)} se ha vuelto blanca y ${NAMES.guardian} espera junto al Corazón.`];
}

/** El Guardián's six lines (post-game hints), in order. */
export const GUARDIAN_LINES: readonly string[] = [
  `«Hola. Antes era más alto. Y más antipático.»`,
  `«En ${NAMES.rim} se ha abierto ${NAMES.crack}. Ya se sube andando, sin dragón.»`,
  `«Aún quedan bestias sueltas. Si no queréis asedios, el Menú del Corazón los apaga.»`,
  `«La ${NAMES.thorn} sigue creciendo en ${NAMES.thornland}. Algo tendréis que hacer con ella.»`,
  `«Las fogatas encendidas os llevan lejos. Yo me quedo aquí, gracias.»`,
  `«${up(NAMES.villainTower)} ya no da miedo. Algún día a lo mejor se sube.»`,
];

/** Where el Guardián stands. */
export function guardianSpot(heart: { x: number; z: number }): { x: number; z: number } {
  return { x: heart.x + ENDING.guardian.dx, z: heart.z };
}

/** A post-ending wave: 60 % of the normal one, at least one beast. */
export function endingWave(n: number): number {
  return Math.max(1, Math.ceil(n * ENDING.raidMult));
}

/**
 * El Árbol-torre (spec S5 §12, S5-H): after the ending the white tower is a lookout. Its top is a `r` m disc
 * `h` m above the ground at the tower (the tower's full height), where fogata 7 burns.
 */
export const LOOKOUT = { r: 7, h: TOWER.max } as const;

/** On the top disc (in plan). */
export function inLookout(x: number, z: number): boolean {
  return Math.hypot(x - TOWER.x, z - TOWER.z) <= LOOKOUT.r;
}

/** The top's centre. Measured just off the disc (the plateau is flat), so a raised terrain gives the same top. */
export function lookoutTop(t: Terrain): { x: number; y: number; z: number } {
  return { x: TOWER.x, y: t.heightAt(TOWER.x + LOOKOUT.r + 1, TOWER.z) + LOOKOUT.h, z: TOWER.z };
}

/** The terrain with the top disc raised while `open()`: standing up there is ordinary ground. */
export function withLookout(base: Terrain, open: () => boolean): Terrain {
  return {
    heightAt: (x, z) => base.heightAt(x, z) + (open() && inLookout(x, z) ? LOOKOUT.h : 0),
    density: (x, z) => base.density(x, z),
    ...(base.waterAt ? { waterAt: (x: number, z: number) => base.waterAt!(x, z) } : {}),
  };
}
