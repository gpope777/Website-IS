import { CORRUPT_ZONES, MOUNTAIN_ZONES, SWAMP_ZONES } from '../corruption';
import { WATER_LEVEL, type Terrain } from '../terrain';
import { ENEMY, stepWolf, type RaidGoal, type Wolf, type WolfTarget } from './wolves';

/**
 * La Gata Araña (spec S3 §8): the first lieutenant. Once anyone has seen the swamp and while its
 * Raíz-madre (zone 10) is corrupt, she leads every 3rd raid. She hunts players, not the Heart;
 * raiders near her run faster; when she falls the rest of the raid flees.
 */
export const GATA = { hp: 300, damage: 12, biteCooldown: 2, aura: 8, haste: 1.2, every: 3, amber: 2, present: 40, fleeFor: 3, behind: 10, hold: 14, sight: 28 } as const;

/** Does raid number `raidN` (1-based, counted at the dusk warning) bring her? */
export function gataLeads(raidN: number, swampSeen: boolean, corrupt: readonly number[]): boolean {
  return swampSeen && corrupt.includes(SWAMP_ZONES.root) && raidN > 0 && raidN % GATA.every === 0;
}

/** Hunt the nearest living player within sight; with none, walk toward the Heart and wait `hold` m short of it. */
export function stepGata(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): string | null {
  return stepLieutenant(w, targets, goal, terrain, dt, rng, ENEMY.lieut1.run);
}

/** The lieutenants' shared walk (the Gata's, S3-D). */
function stepLieutenant(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number, speed: number): string | null {
  const alive = targets.filter((t) => !t.dead);
  let near: WolfTarget | undefined;
  let best: number = GATA.sight;
  for (const t of alive) {
    const d = Math.hypot(t.x - w.x, t.z - w.z);
    if (d < best) [best, near] = [d, t];
  }
  if (w.hp <= 0 || w.stun > 0 || near) return stepWolf(w, near ? [{ ...near, fires: false }] : [], terrain, dt, rng);
  w.target = null;
  w.cooldown = Math.max(0, w.cooldown - dt);
  const dx = goal.x - w.x;
  const dz = goal.z - w.z;
  const d = Math.max(Math.hypot(dx, dz), 1e-4);
  w.yaw = Math.atan2(dx / d, dz / d);
  if (d <= GATA.hold) {
    w.anim = 'idle';
    return null;
  }
  // Same simple walk as the raiders, sidestepping water.
  const run = Math.min(d - GATA.hold, speed * dt);
  const nx = w.x + (dx / d) * run;
  const nz = w.z + (dz / d) * run;
  if (terrain.heightAt(nx, nz) >= WATER_LEVEL) [w.x, w.z] = [nx, nz];
  else [w.x, w.z] = [w.x + (dz / d) * run, w.z - (dx / d) * run];
  w.y = terrain.heightAt(w.x, w.z);
  w.anim = 'run';
  return null;
}

/** Speed factor for a raider at (x, z) given where the living Gata is (null: none). */
export function hasteNear(gata: { x: number; z: number } | null, x: number, z: number): number {
  return gata && Math.hypot(gata.x - x, gata.z - z) <= GATA.aura ? GATA.haste : 1;
}

/**
 * El Triángulo (spec S4 §7): the second lieutenant. Once anyone has seen the mountains and while
 * their Raíz-madre (zone 14) is corrupt, he leads raids with raidN % 3 === 1 (from the 4th; the Gata
 * takes the multiples of 3). He walks like the Gata and throws rocks at player structures, never at
 * the Heart. Beating El Cucurucho cleanses 14, and with it he stops coming.
 */
export const TRIANGULO = { hp: 340, damage: 12, every: 3, offset: 1, rockEvery: 6, rockRange: 25, rockDamage: 40, quartz: 2, present: 40, behind: 12 } as const;

export function triLeads(raidN: number, mountainsSeen: boolean, corrupt: readonly number[]): boolean {
  return mountainsSeen && corrupt.includes(MOUNTAIN_ZONES.root) && raidN > TRIANGULO.every && raidN % TRIANGULO.every === TRIANGULO.offset;
}

export function stepTriangulo(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): string | null {
  return stepLieutenant(w, targets, goal, terrain, dt, rng, ENEMY.lieut2.run);
}

/** The nearest player structure (not the Heart) within rock range, or null. Piedra pillars are structures, so they count too. */
export function rockTarget(w: { x: number; z: number }, structures: readonly { id: number; kind: string; x: number; z: number }[]): number | null {
  let best: number | null = null;
  let bestD: number = TRIANGULO.rockRange;
  for (const s of structures) {
    if (s.kind === 'heart') continue;
    const d = Math.hypot(s.x - w.x, s.z - w.z);
    if (d <= bestD) [bestD, best] = [d, s.id];
  }
  return best;
}

/**
 * La Flecha (spec S5 §9): the third lieutenant. Once anyone has walked las Tierras and while la Torre's
 * zone (18) is corrupt, she leads raids with raidN % 3 === 2 (the Gata takes 0, the Triángulo 1). She walks
 * like the others and every 7 s does the clavada: a red line on the ground for 1 s, then a 20 m/s dash
 * along it (20 to anyone on the way; roll dodges). A structure on the line stops her: stuck 4 s.
 */
export const FLECHA = { hp: 360, damage: 12, every: 3, offset: 2, clavEvery: 7, clavRange: 20, tell: 1, dashSpeed: 20, dashDamage: 20, overshoot: 4, maxDash: 24, hitR: 1.2, stickR: 1.5, stuck: 4, thorns: 2, present: 40, behind: 12 } as const;

export function flechaLeads(raidN: number, corruptSeen: boolean, corrupt: readonly number[]): boolean {
  return corruptSeen && corrupt.includes(CORRUPT_ZONES.tower) && raidN > 0 && raidN % FLECHA.every === FLECHA.offset;
}

type Spot = { x: number; z: number };

/** Where a dash from `from` to `to` ends: at the first player structure (not the Heart) within 1.5 m of the line, stuck; else at `to`. */
export function clavadaStop(from: Spot, to: Spot, structures: readonly { kind: string; x: number; z: number }[]): Spot & { stuck: boolean } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.max(Math.hypot(dx, dz), 1e-4);
  let best = Infinity;
  for (const s of structures) {
    if (s.kind === 'heart') continue;
    const t = ((s.x - from.x) * dx + (s.z - from.z) * dz) / (len * len);
    if (t < 0 || t > 1) continue;
    const off = Math.hypot(s.x - (from.x + dx * t), s.z - (from.z + dz * t));
    if (off <= FLECHA.stickR && t < best) best = t;
  }
  if (best === Infinity) return { ...to, stuck: false };
  const k = Math.max(0, best - FLECHA.stickR / len);
  return { x: from.x + dx * k, z: from.z + dz * k, stuck: true };
}

/** One tick of La Flecha: stuck, dashing, aiming, or walking like the Gata. `bite` = her kick; `hits` = players the dash went through. */
export function stepFlecha(w: Wolf, targets: WolfTarget[], structures: readonly { kind: string; x: number; z: number }[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): { bite: string | null; hits: string[] } {
  const none = { bite: null, hits: [] as string[] };
  if (w.hp <= 0) return none;
  if ((w.stuck ?? 0) > 0) {
    w.stuck = Math.max(0, w.stuck! - dt);
    w.anim = 'idle';
    return none;
  }
  const alive = targets.filter((t) => !t.dead);
  if (w.clav) {
    const d = w.clav;
    const dx = d.x - w.x;
    const dz = d.z - w.z;
    const left = Math.hypot(dx, dz);
    const run = Math.min(left, FLECHA.dashSpeed * dt);
    if (left > 1e-4) [w.x, w.z] = [w.x + (dx / left) * run, w.z + (dz / left) * run];
    w.y = terrain.heightAt(w.x, w.z);
    w.anim = 'run';
    const hits: string[] = [];
    for (const t of alive) {
      if ((w.dashHit ?? []).includes(t.name) || Math.hypot(t.x - w.x, t.z - w.z) > FLECHA.hitR) continue;
      w.dashHit = [...(w.dashHit ?? []), t.name];
      hits.push(t.name);
    }
    if (left - run <= 1e-3) {
      w.clav = undefined;
      w.dashHit = undefined;
      w.clavIn = FLECHA.clavEvery;
      if (d.stuck) w.stuck = FLECHA.stuck;
    }
    return { bite: null, hits };
  }
  if (w.aim) {
    w.aimFor = (w.aimFor ?? 0) - dt;
    w.anim = 'attack';
    if (w.aimFor <= 0) {
      w.clav = clavadaStop(w, w.aim, structures);
      w.aim = undefined;
    }
    return none;
  }
  w.clavIn = (w.clavIn ?? FLECHA.clavEvery) - dt;
  if (w.clavIn <= 0) {
    let near: WolfTarget | undefined;
    let best: number = FLECHA.clavRange;
    for (const t of alive) {
      const d = Math.hypot(t.x - w.x, t.z - w.z);
      if (d <= best) [best, near] = [d, t];
    }
    if (near) {
      const d = Math.max(best, 1e-4);
      const len = Math.min(FLECHA.maxDash, d + FLECHA.overshoot);
      w.aim = { x: w.x + ((near.x - w.x) / d) * len, z: w.z + ((near.z - w.z) / d) * len };
      w.aimFor = FLECHA.tell;
      w.yaw = Math.atan2(near.x - w.x, near.z - w.z);
      w.anim = 'attack';
      return none;
    }
    w.clavIn = 0;
  }
  return { bite: stepLieutenant(w, targets, goal, terrain, dt, rng, ENEMY.lieut3.run), hits: [] };
}
