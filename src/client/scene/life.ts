import { TIERS, type Tier } from '../quality';
import type { Biome } from './looks';

/** V2-D (spec §3, §5.6): pure rules for the ambient life. Decorative only: no network, no collision. */
export interface LifeAmounts {
  flocks: number;
  /** Birds per flock. */
  birds: number;
  fireflies: number;
  particles: number;
  crabs: number;
  fish: number;
}

export function lifeFor(tier: Tier): LifeAmounts {
  const t = TIERS[tier];
  return {
    flocks: tier === 'low' ? 1 : tier === 'medium' ? 2 : 3,
    birds: 12,
    fireflies: t.ambient,
    particles: t.particles,
    crabs: tier === 'low' ? 0 : 10,
    fish: tier === 'high' ? 20 : 0,
  };
}

export type BirdKind = 'dark' | 'gull' | 'eagle';
export type ParticleKind = 'leaves' | 'midges' | 'snow' | 'ash';

export interface LifeHere {
  birds: BirdKind | null;
  /** 0 none … 1 full brightness. */
  fireflies: number;
  /** Golden fireflies (purified Tierras). */
  golden: boolean;
  particles: ParticleKind | null;
  crabs: boolean;
  fish: boolean;
}

/** Night is frac < 0.22 or > 0.78 (the same edges as the day clock's dawn/dusk). */
export function isNight(frac: number): boolean {
  return frac < 0.22 || frac > 0.78;
}

export function lifeAt(biome: Biome, frac: number, purified: boolean): LifeHere {
  const night = isNight(frac);
  const out: LifeHere = { birds: null, fireflies: 0, golden: false, particles: null, crabs: false, fish: false };
  switch (biome) {
    case 'bosque':
      out.birds = night ? null : 'dark';
      out.fireflies = night ? 1 : 0;
      out.particles = night ? null : 'leaves';
      break;
    case 'costa':
      out.birds = night ? null : 'gull';
      out.crabs = !night;
      out.fish = true;
      break;
    case 'pantano':
      out.fireflies = night ? 1 : 0.35;
      out.particles = 'midges';
      break;
    case 'montanas':
      out.birds = night ? null : 'eagle';
      out.particles = 'snow';
      break;
    case 'tierras':
      if (purified) {
        out.birds = night ? null : 'dark';
        out.fireflies = night ? 1 : 0;
        out.golden = true;
      } else out.particles = 'ash';
      break;
  }
  return out;
}

/** Birds loop around an anchor on a 160 m grid near the player (so a flock does not follow you exactly). */
export const FLOCK = { grid: 160, rx: 45, rz: 30, height: 28, eagleHeight: 45, speed: 0.07 } as const;

export function flockAnchor(x: number, z: number): { x: number; z: number } {
  return { x: Math.round(x / FLOCK.grid) * FLOCK.grid, z: Math.round(z / FLOCK.grid) * FLOCK.grid };
}

/** Where flock `i` is at time `t` (a Lissajous loop; each flock its own phase and offset). Mirrors the shader. */
export function flockPoint(i: number, t: number, anchor: { x: number; z: number }): { x: number; y: number; z: number } {
  const ph = t * FLOCK.speed + i * 2.1;
  return {
    x: anchor.x + Math.sin(ph) * FLOCK.rx + (i - 1) * 25,
    y: FLOCK.height + Math.sin(ph * 3) * 3 + i * 4,
    z: anchor.z + Math.sin(ph * 2 + i) * FLOCK.rz,
  };
}

/** A value wrapped into [centre − box/2, centre + box/2) (the shader's `mod` trick that keeps points around the player). */
export function wrap(v: number, centre: number, box: number): number {
  const r = (((v - centre + box / 2) % box) + box) % box;
  return centre - box / 2 + r;
}

export const CRAB = { flee: 4, speed: 3 } as const;

export interface Crab {
  x: number;
  z: number;
  /** Facing (rad); crabs run sideways, perpendicular to it. */
  yaw: number;
}

/** A crab near the player scuttles sideways away from it; otherwise it stays. */
export function crabStep(c: Crab, px: number, pz: number, dt: number): Crab {
  const dx = c.x - px;
  const dz = c.z - pz;
  const d = Math.hypot(dx, dz);
  if (d >= CRAB.flee) return c;
  // Sideways axis of the crab, pointed away from the player.
  let sx = Math.cos(c.yaw);
  let sz = -Math.sin(c.yaw);
  if (sx * dx + sz * dz < 0) {
    sx = -sx;
    sz = -sz;
  }
  const k = CRAB.speed * dt;
  return { x: c.x + sx * k, z: c.z + sz * k, yaw: c.yaw };
}
