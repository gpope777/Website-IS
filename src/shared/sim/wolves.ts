import { HALF, WATER_LEVEL, type Terrain } from '../terrain';
import type { WolfAnim } from '../protocol';

export const WOLF = {
  hp: 60,
  walk: 2.4,
  run: 6.2,
  sight: 28,
  giveUp: 45,
  reach: 1.8,
  damage: 10,
  biteCooldown: 1.4,
  fearRadius: 6,
  count: 5,
  spawnMin: 35,
  spawnMax: 60,
  corpseTime: 5,
} as const;

export interface Wolf {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  target: string | null;
  cooldown: number;
  deadFor: number;
  wander: number;
  anim: WolfAnim;
}

export interface WolfTarget {
  name: string;
  x: number;
  z: number;
  dead: boolean;
  /** Standing near a campfire: wolves keep away. */
  fires: boolean;
}

export function createWolf(id: number, x: number, z: number, terrain: Terrain, rng: () => number): Wolf {
  return { id, x, y: terrain.heightAt(x, z), z, yaw: 0, hp: WOLF.hp, target: null, cooldown: 0, deadFor: 0, wander: rng() * Math.PI * 2, anim: 'idle' };
}

const dist = (w: Wolf, t: WolfTarget) => Math.hypot(t.x - w.x, t.z - w.z);

export function stepWolf(w: Wolf, targets: WolfTarget[], terrain: Terrain, dt: number, rng: () => number): string | null {
  if (w.hp <= 0) {
    w.deadFor += dt;
    w.anim = 'dead';
    return null;
  }
  w.cooldown = Math.max(0, w.cooldown - dt);

  const huntable = (t: WolfTarget) => !t.dead && !t.fires;
  let target = targets.find((t) => t.name === w.target && huntable(t) && dist(w, t) < WOLF.giveUp) ?? null;
  if (!target) {
    let best = WOLF.sight;
    for (const t of targets) {
      const d = dist(w, t);
      if (huntable(t) && d < best) {
        best = d;
        target = t;
      }
    }
  }

  let dirX = 0;
  let dirZ = 0;
  let speed = 0;
  let bitten: string | null = null;
  const scary = targets.find((t) => t.fires && dist(w, t) < WOLF.fearRadius + 4);

  if (scary) {
    const d = Math.max(dist(w, scary), 1e-4);
    dirX = (w.x - scary.x) / d;
    dirZ = (w.z - scary.z) / d;
    speed = WOLF.run;
    target = null;
  } else if (target) {
    const d = Math.max(dist(w, target), 1e-4);
    dirX = (target.x - w.x) / d;
    dirZ = (target.z - w.z) / d;
    if (d > WOLF.reach) {
      speed = WOLF.run;
    } else {
      w.yaw = Math.atan2(dirX, dirZ);
      if (w.cooldown === 0) {
        w.cooldown = WOLF.biteCooldown;
        bitten = target.name;
      }
    }
  } else {
    w.wander += (rng() - 0.5) * dt * 1.5;
    dirX = Math.sin(w.wander);
    dirZ = Math.cos(w.wander);
    speed = WOLF.walk;
  }
  w.target = target?.name ?? null;

  if (speed > 0) {
    const nx = Math.max(-HALF + 4, Math.min(HALF - 4, w.x + dirX * speed * dt));
    const nz = Math.max(-HALF + 4, Math.min(HALF - 4, w.z + dirZ * speed * dt));
    if (terrain.heightAt(nx, nz) < WATER_LEVEL) {
      w.wander += Math.PI; // turn around at the shore
    } else {
      w.x = nx;
      w.z = nz;
      w.y = terrain.heightAt(nx, nz);
    }
    w.yaw = Math.atan2(dirX, dirZ);
  }
  w.anim = speed === 0 ? (target ? 'attack' : 'idle') : speed >= WOLF.run ? 'run' : 'walk';
  return bitten;
}

export function hitWolf(w: Wolf, dmg: number): boolean {
  if (w.hp <= 0) return false;
  w.hp = Math.max(0, w.hp - dmg);
  if (w.hp > 0) return false;
  w.anim = 'dead';
  w.target = null;
  return true;
}
