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
  raid: boolean;
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
  return { id, x, y: terrain.heightAt(x, z), z, yaw: 0, hp: WOLF.hp, target: null, cooldown: 0, deadFor: 0, wander: rng() * Math.PI * 2, anim: 'idle', raid: false };
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
    let best: number = WOLF.sight;
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

export const RAID = {
  /** Warning starts at this day fraction; night (the attack) starts at 0.8. */
  warnAt: 0.72,
  base: 4,
  perLevel: 2,
  perPlayer: 2,
  maxWave: 20,
  spawnMin: 45,
  spawnMax: 60,
  aggro: 10,
  structReach: 2.2,
  heartReach: 2.6,
  damage: 12,
  cooldown: 1.2,
} as const;

export interface RaidGoal {
  heartId: number;
  x: number;
  z: number;
  /** Wall sample points (3 per wall) that stop the march. */
  blockers: { id: number; x: number; z: number }[];
}

export type RaidHit = { player: string } | { structure: number } | null;

/** Corrupted raider: not scared of fire, fights players who come close, otherwise marches on the Heart and chews what blocks it. */
export function stepRaider(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): RaidHit {
  if (w.hp <= 0) {
    stepWolf(w, [], terrain, dt, rng);
    return null;
  }
  const near = targets
    .filter((t) => !t.dead && Math.hypot(t.x - w.x, t.z - w.z) < RAID.aggro)
    .map((t) => ({ ...t, fires: false }));
  if (near.length) {
    const bit = stepWolf(w, near, terrain, dt, rng);
    return bit ? { player: bit } : null;
  }
  w.target = null;
  w.cooldown = Math.max(0, w.cooldown - dt);
  const dx = goal.x - w.x;
  const dz = goal.z - w.z;
  const d = Math.max(Math.hypot(dx, dz), 1e-4);
  w.yaw = Math.atan2(dx / d, dz / d);
  const victim = d < RAID.heartReach ? goal.heartId : goal.blockers.find((b) => Math.hypot(b.x - w.x, b.z - w.z) < RAID.structReach)?.id;
  if (victim !== undefined) {
    w.anim = 'attack';
    if (w.cooldown > 0) return null;
    w.cooldown = RAID.cooldown;
    return { structure: victim };
  }
  const nx = w.x + (dx / d) * WOLF.run * dt;
  const nz = w.z + (dz / d) * WOLF.run * dt;
  if (terrain.heightAt(nx, nz) >= WATER_LEVEL) {
    w.x = nx;
    w.z = nz;
  } else {
    // ponytail: sidestep water by walking perpendicular; real pathfinding if raiders get stuck in playtest
    w.x += (dz / d) * WOLF.run * dt;
    w.z -= (dx / d) * WOLF.run * dt;
  }
  w.y = terrain.heightAt(w.x, w.z);
  w.anim = 'run';
  return null;
}
