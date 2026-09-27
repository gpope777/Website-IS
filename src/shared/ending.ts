import { NAMES } from './names';

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

/** What someone who wasn't online sees on their first login after. */
export function lateCards(names: string): string[] {
  return [`Mientras dormías, ${names} vencieron a ${NAMES.villain}.`, `${up(NAMES.villainTower)} se ha vuelto blanca y ${NAMES.guardian} espera junto al Corazón.`];
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
