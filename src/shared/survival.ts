/** Co-op vitals: health, hunger, warmth. Pure; time in real seconds; values 0..100. */
export interface Vitals {
  health: number;
  hunger: number; // 100 = full
  warmth: number; // 100 = warm
}

export const VITAL_MAX = 100;

export const RATES = {
  hunger: 100 / (10 * 60),
  warmthNight: 100 / (3 * 60),
  warmthDay: 100 / 60,
  warmthFire: 100 / 20,
  starve: 100 / (2 * 60),
  cold: 100 / 100,
  regen: 100 / (4 * 60),
} as const;

export const BERRY = { hunger: 15, health: 3 } as const;
export const RESPAWN_VITALS: Vitals = { health: 100, hunger: 70, warmth: 80 };

export function clamp(v: number, lo = 0, hi = VITAL_MAX): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createVitals(): Vitals {
  return { health: 100, hunger: 100, warmth: 100 };
}

/** dayFraction 0..1, 0 = midnight. */
export function isNight(dayFraction: number): boolean {
  const f = ((dayFraction % 1) + 1) % 1;
  return f < 0.22 || f > 0.8;
}

export interface VitalsEnv {
  night: boolean;
  nearFire: boolean;
  /** High in las Montañas (S4 §3.4): away from a fire, warmth drains like night by day and twice as fast at night. */
  cold?: boolean;
}

export function tickVitals(v: Vitals, env: VitalsEnv, dt: number): Vitals {
  const hunger = clamp(v.hunger - RATES.hunger * dt);
  const warmthRate = env.nearFire ? RATES.warmthFire : env.cold ? -RATES.warmthNight * (env.night ? 2 : 1) : env.night ? -RATES.warmthNight : RATES.warmthDay;
  const warmth = clamp(v.warmth + warmthRate * dt);
  let hurt = 0;
  if (hunger === 0) hurt += RATES.starve;
  if (warmth === 0) hurt += RATES.cold;
  const regen = hurt === 0 && hunger > 60 && warmth > 40 ? RATES.regen : 0;
  return { hunger, warmth, health: clamp(v.health + (regen - hurt) * dt) };
}

export function eatBerry(v: Vitals): Vitals {
  return { ...v, hunger: clamp(v.hunger + BERRY.hunger), health: clamp(v.health + BERRY.health) };
}

export function damage(v: Vitals, amount: number): Vitals {
  return { ...v, health: clamp(v.health - amount) };
}
