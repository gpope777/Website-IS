import { MOUNTAIN_ZONES, SWAMP_ZONES } from '../corruption';
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
 * the Heart. S4-F: beating El Cucurucho cleanses 14, and with it he stops coming.
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
