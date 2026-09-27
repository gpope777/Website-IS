import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * El Marchito in person (spec §2, invasion 1): he walks in from the Raíz-madre, smashes the
 * nearer half of the defenses, swats whoever is in his way, laughs and leaves. He cannot die:
 * his hp is "voluntad", and at 0 he is driven off (the world decides that, not this file).
 */
export const MARCHITO = { id: 900_000, delay: 20, spawnDist: 28, smashReach: 2.6, smashTime: 2.5, laughFor: 4, maxTime: 120, height: 7 } as const;

export interface Marchito extends Wolf {
  /** Structure ids still to smash, nearest the Heart first. */
  prey: number[];
  /** Seconds spent smashing the current prey. */
  smash: number;
  /** Seconds left laughing before he leaves (0 = not laughing). */
  laugh: number;
  /** Seconds since he arrived. */
  age: number;
  /** Players he already mocked. */
  taunted: string[];
  /** He has left (driven off or done laughing): no more events. */
  left: boolean;
  /** Voluntad he arrived with (scaled to the players present). */
  max: number;
}

/** Voluntad for 1–4 active players: about 10–15 s of one player's blows each. */
export function marchitoWill(players: number): number {
  return 180 + 120 * Math.max(1, Math.min(4, Math.round(players)));
}

export type MarchitoEvent = { t: 'smash'; id: number } | { t: 'swipe'; name: string } | { t: 'laugh' } | { t: 'leave' } | null;

/** The nearer half (rounded up) of everything but the Heart. */
export function pickDefenses(structs: readonly { id: number; kind: string; x: number; z: number }[], heart: { x: number; z: number }): number[] {
  const d = (s: { x: number; z: number }) => Math.hypot(s.x - heart.x, s.z - heart.z);
  const all = structs.filter((s) => s.kind !== 'heart').sort((a, b) => d(a) - d(b) || a.id - b.id);
  return all.slice(0, Math.ceil(all.length / 2)).map((s) => s.id);
}

export function createMarchito(x: number, y: number, z: number, prey: number[], will: number = ENEMY.marchito.hp): Marchito {
  return {
    id: MARCHITO.id, x, y, z, yaw: 0, hp: will, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false, kind: 'marchito', stun: 0,
    prey: [...prey], smash: 0, laugh: 0, age: 0, taunted: [], left: false, max: will,
  };
}

/** One tick. `structs` are the structures that still exist (at least his prey). */
export function stepMarchito(m: Marchito, structs: readonly { id: number; x: number; z: number }[], players: readonly WolfTarget[], heightAt: (x: number, z: number) => number, dt: number): MarchitoEvent {
  const def = ENEMY.marchito;
  if (m.left) return null;
  m.age += dt;
  m.cooldown = Math.max(0, m.cooldown - dt);
  if (m.laugh > 0) {
    m.laugh = Math.max(0, m.laugh - dt);
    m.anim = 'idle';
    if (m.laugh > 1e-9) return null;
    m.left = true;
    return { t: 'leave' };
  }
  if (m.stun > 0) {
    m.stun = Math.max(0, m.stun - dt);
    m.anim = 'idle';
    return null;
  }
  const near = players.find((p) => !p.dead && Math.hypot(p.x - m.x, p.z - m.z) <= def.reach);
  if (near && m.cooldown === 0) {
    m.cooldown = def.biteCooldown;
    m.yaw = Math.atan2(near.x - m.x, near.z - m.z);
    m.anim = 'attack';
    return { t: 'swipe', name: near.name };
  }
  m.prey = m.prey.filter((id) => structs.some((s) => s.id === id));
  const prey = structs.find((s) => s.id === m.prey[0]);
  if (!prey || m.age >= MARCHITO.maxTime) {
    m.laugh = MARCHITO.laughFor;
    m.anim = 'idle';
    return { t: 'laugh' };
  }
  const dx = prey.x - m.x;
  const dz = prey.z - m.z;
  const d = Math.hypot(dx, dz);
  if (d > MARCHITO.smashReach) {
    const step = Math.min(d - MARCHITO.smashReach * 0.8, def.run * dt);
    m.x += (dx / d) * step;
    m.z += (dz / d) * step;
    m.y = heightAt(m.x, m.z);
    m.yaw = Math.atan2(dx, dz);
    m.anim = 'walk';
    m.smash = 0;
    return null;
  }
  m.anim = 'attack';
  m.smash += dt;
  if (m.smash + 1e-9 < MARCHITO.smashTime) return null;
  m.smash = 0;
  m.prey.shift();
  return { t: 'smash', id: prey.id };
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'nadie';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** What he says. Dry, short, a little theatrical. */
export const VISION = {
  purified: (names: string) => ['Una voz como hojas secas:', `«Así que muerden, las ramitas. ${names}.»`, '«Iré a ver ese Corazón yo mismo.»'],
  arrive: ['El Marchito entra en el claro. No se le puede matar.', '«Bonito Corazón. Sería una pena.»', 'Aguanten, o échenlo a golpes.'],
  laugh: ['El Marchito se ríe como una rama al partirse.', '«Solo vine a mirar. La próxima vez me quedo.»'],
  driven: (names: string) => ['El Marchito retrocede entre la niebla.', `«${names}. Me acordaré de sus nombres.»`],
  taunt: (name: string) => `«¿Eso es todo, ${name}?»`,
};
