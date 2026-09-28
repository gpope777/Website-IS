import { TOWER_DUNGEON as T } from '../tower-dungeon';
import type { Wolf, WolfTarget } from './wolves';

/**
 * El Marchito, the final boss in the Copa (spec S5 §11.3), with real HP at last.
 * Phase 1 (100 → 60 %): wrapped in roots (×0.2) until a Llamarada burns them off; swipes and root lines.
 * Phase 2 (60 → 25 %): he sinks (invulnerable); four brotes at the edge, one per power; each pulled out costs him 8.75 %.
 * Phase 3 (25 → 0 %): the body freezes and el Corazón Negro (enemy8) runs; Piedra stops it, arrows hurt it most.
 */
export const FINAL = {
  id: 900_009,
  coreId: 900_010,
  broteIds: [900_011, 900_012, 900_013, 900_014],
  x: T.x,
  z: T.copa.z,
  baseHp: 1200,
  perPlayer: 0.35,
  /** [D] P7-E: alone he has ×1.3 PV (body and core): the solo fight ran ~6.1 min against a ~8 min target. */
  soloFactor: 1.3,
  p2At: 0.6,
  p3At: 0.25,
  body: 2.5,
  // Phase 1
  rootMult: 0.1,
  /** A Llamarada within this of his body sets the roots alight: `catchFor` s later they are gone for `bareFor` s. */
  burnReach: 5,
  catchFor: 2,
  bareFor: 8,
  /** [D] New roots are green this long: fire doesn't take (the phase's pacing knob). */
  greenFor: 24,
  swipeFirst: 4,
  swipeEvery: 10,
  swipeTell: 1,
  swipeReach: 5,
  swipeDamage: 18,
  staggerFor: 3,
  linesFirst: 7,
  linesEvery: 15,
  linesTell: 1.2,
  lineCount: 3,
  lineLen: 20,
  lineHalf: 1,
  lineDamage: 15,
  // Phase 2
  broteShare: 0.0875,
  /** The four brotes (Enredadera, Viento, Fuego, Piedra), 16 m out on the diagonals. */
  brotes: [
    { x: -11.3, z: -11.3 },
    { x: -11.3, z: 11.3 },
    { x: 11.3, z: 11.3 },
    { x: 11.3, z: -11.3 },
  ],
  /** [D] Each brote is a small pillar: this many casts of its power open it (Piedra: a pillar on its plate). */
  need: { vine: 2, wind: 3, fire: 3, stone: 1 },
  /** [D] Seconds a brote's work holds after the last cast before it closes again (the cocoon stays burnt). */
  hold: { vine: 30, wind: 15, fire: 9999, stone: 9999 },
  /** A vine / gust / Llamarada this close to a brote counts. */
  castReach: 4,
  /** Piedra: the plate, 3 m toward the centre; a pillar within `plateR` weighs it. */
  plates: { x: 9.2, z: -9.2 },
  plateR: 2,
  pullFor: 1.5,
  pullReach: 3,
  /** Rayos harassing in phase 2: 1 alone, 2 with friends; one comes back `rayoRespawn` s after it falls. */
  rayos: [1, 2],
  rayoRespawn: 10,
  // Phase 3
  coreHp: 300,
  coreSpeed: 7,
  coreBody: 0.8,
  /** How far from the centre it may run. */
  coreRoom: 19,
  /** [D] Not stopped by a pillar, its legs turn blows aside: damage × this. */
  coreRunMult: 0.1,
  arrowMult: 1.5,
  trailEvery: 0.5,
  trailLife: 4,
  trailR: 1,
  trailDps: 4,
  returnEvery: 10,
  /** Healing at his body: this share of the core's max per second, until hit. */
  healRate: 0.05,
  stunFor: 3,
  pillarR: 2,
  corpseTime: 6,
} as const;

export type BroteKind = 'vine' | 'wind' | 'fire' | 'stone';
export const BROTE_KINDS: readonly BroteKind[] = ['vine', 'wind', 'fire', 'stone'];

export interface Brote extends Wolf {
  power: BroteKind;
  broken: boolean;
  /** Casts of its power so far, and seconds before they come undone. */
  steps: number;
  openFor: number;
}

export interface Core extends Wolf {
  max: number;
  mode: 'run' | 'back' | 'heal';
  returnIn: number;
  trailIn: number;
  /** Pillars that already stopped it (each one only once). */
  stoppedBy: number[];
}

export interface FinalBoss extends Wolf {
  max: number;
  factor: number;
  phase: 1 | 2 | 3;
  /** Phase 1: seconds until the roots burn off, bare seconds left, green seconds left, stagger left. */
  catching: number;
  bare: number;
  green: number;
  stagger: number;
  swipeIn: number;
  swipeTell: number;
  linesIn: number;
  linesTell: number;
  lines: { x0: number; z0: number; x1: number; z1: number }[];
  brotes: Brote[];
  pull: { name: string; i: number; left: number } | null;
  core: Core | null;
  trail: { x: number; z: number; t: number }[];
}

export type FinalHit = { name: string; dmg: number; kind: 'swipe' | 'line' | 'trail' };

export function finalFactor(players: number): number {
  if (Math.floor(players) <= 1) return FINAL.soloFactor;
  return 1 + FINAL.perPlayer * (Math.floor(players) - 1);
}

export function createFinal(players: number): FinalBoss {
  const factor = finalFactor(players);
  const max = Math.round(FINAL.baseHp * factor);
  return {
    id: FINAL.id, x: FINAL.x, y: T.floor, z: FINAL.z, yaw: Math.PI, hp: max, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false,
    kind: 'boss5', stun: 0, max, factor, phase: 1, catching: 0, bare: 0, green: 0, stagger: 0, swipeIn: FINAL.swipeFirst, swipeTell: 0, linesIn: FINAL.linesFirst,
    linesTell: 0, lines: [], brotes: [], pull: null, core: null, trail: [],
  };
}

/** Damage multiplier on his body right now (0 = untouchable). */
export function finalMult(b: FinalBoss): number {
  if (b.hp <= 0 || b.phase !== 1) return 0;
  return b.bare > 0 || b.stagger > 0 ? 1 : FINAL.rootMult;
}

/** A Llamarada from (x, z): sets the roots alight when close enough, not already burning and not green. */
export function burnRoots(b: FinalBoss, x: number, z: number): 'catch' | 'green' | 'far' | 'no' {
  if (b.phase !== 1 || b.hp <= 0 || b.bare > 0 || b.catching > 0) return 'no';
  if (Math.hypot(x - b.x, z - b.z) - FINAL.body > FINAL.burnReach) return 'far';
  if (b.green > 0) return 'green';
  b.catching = FINAL.catchFor;
  return 'catch';
}

/** A parried swipe: he staggers (no attacks, full damage). */
export function staggerFinal(b: FinalBoss): void {
  if (b.phase !== 1) return;
  b.stagger = FINAL.staggerFor;
  b.swipeTell = 0;
}

function spawnBrotes(b: FinalBoss): void {
  b.brotes = FINAL.brotes.map((p, i) => ({
    id: FINAL.broteIds[i]!, x: FINAL.x + p.x, y: T.floor, z: FINAL.z + p.z, yaw: 0, hp: 1, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false,
    kind: 'brote', stun: 0, power: BROTE_KINDS[i]!, broken: false, steps: 0, openFor: 0,
  }));
}

/** Damage to his body (already multiplied). Returns 'phase2' when he sinks. */
export function hitFinal(b: FinalBoss, dmg: number): 'phase2' | null {
  if (b.phase !== 1 || b.hp <= 0 || dmg <= 0) return null;
  const floor = b.max * FINAL.p2At;
  b.hp = Math.max(floor, b.hp - dmg);
  if (b.hp > floor + 1e-9) return null;
  b.phase = 2;
  b.lines = [];
  b.swipeTell = 0;
  b.linesTell = 0;
  b.bare = 0;
  b.catching = 0;
  b.stagger = 0;
  b.anim = 'idle';
  spawnBrotes(b);
  return 'phase2';
}

/** Whether a brote can be pulled right now; `plateWeighed` for the Piedra one. */
export function broteOpen(br: Brote, plateWeighed: boolean): boolean {
  if (br.broken) return false;
  if (br.power === 'stone') return plateWeighed;
  return br.steps >= FINAL.need[br.power];
}

/** One cast of the brote's own power on it (vine bridge, gust, Llamarada). Returns the count so far, or null if it doesn't take. */
export function castOnBrote(br: Brote, power: BroteKind): number | null {
  if (br.broken || br.power !== power || power === 'stone') return null;
  if (br.steps >= FINAL.need[power]) {
    br.openFor = FINAL.hold[power];
    return br.steps;
  }
  br.steps++;
  br.openFor = FINAL.hold[power];
  return br.steps;
}

/** Where the Piedra brote's plate is. */
export function plateSpot(): { x: number; z: number } {
  return { x: FINAL.x + FINAL.plates.x, z: FINAL.z + FINAL.plates.z };
}

/** Starts pulling brote i (the caller checks reach and that it is open). */
export function startPull(b: FinalBoss, i: number, name: string): void {
  b.pull = { name, i, left: FINAL.pullFor };
}

/** A pulled brote comes out: −8.75 % of his max. The fourth brings phase 3 and the core. */
export function breakBrote(b: FinalBoss, i: number): 'phase3' | 'broke' {
  const br = b.brotes[i]!;
  br.broken = true;
  br.hp = 0;
  const left = b.brotes.filter((x) => !x.broken).length;
  b.hp = b.max * (FINAL.p3At + FINAL.broteShare * left);
  if (left > 0) return 'broke';
  b.phase = 3;
  b.hp = b.max * FINAL.p3At;
  const max = Math.round(FINAL.coreHp * b.factor);
  b.core = {
    id: FINAL.coreId, x: b.x, y: T.floor, z: b.z - FINAL.body - 1, yaw: Math.PI, hp: max, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'run', raid: false,
    kind: 'core', stun: 0, max, mode: 'run', returnIn: FINAL.returnEvery, trailIn: 0, stoppedBy: [],
  };
  return 'phase3';
}

/**
 * A blow on el Corazón Negro. Only a stopped core (a pillar, `stun`) really takes it, arrows ×1.5; running or
 * healing, the legs turn it aside (×`coreRunMult`), but any blow stops a heal. Returns true when it dies (the fight is won).
 */
export function hitCore(b: FinalBoss, dmg: number, arrow: boolean): boolean {
  const c = b.core;
  if (!c || c.hp <= 0) return false;
  if (c.mode === 'heal') {
    c.mode = 'run';
    c.returnIn = FINAL.returnEvery;
  }
  dmg *= (arrow ? FINAL.arrowMult : 1) * (c.stun > 0 ? 1 : FINAL.coreRunMult);
  if (dmg <= 0) return false;
  c.hp = Math.max(0, c.hp - dmg);
  b.hp = b.max * FINAL.p3At * (c.hp / c.max);
  if (c.hp > 0) return false;
  c.anim = 'dead';
  b.hp = 0;
  b.anim = 'dead';
  return true;
}

function segDist(px: number, pz: number, l: { x0: number; z0: number; x1: number; z1: number }): number {
  const dx = l.x1 - l.x0;
  const dz = l.z1 - l.z0;
  const t = Math.max(0, Math.min(1, ((px - l.x0) * dx + (pz - l.z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (l.x0 + t * dx), pz - (l.z0 + t * dz));
}

/**
 * One tick. `targets`: fighters in the Copa; `pillars`: live Piedra pillars (id + centre). Returns hits for the
 * caller to resolve (swipes and lines can be rolled or parried; the trail can't), plus what happened.
 */
export function stepFinal(b: FinalBoss, targets: readonly WolfTarget[], pillars: readonly { id: number; x: number; z: number }[], dt: number, rng: () => number): { hits: FinalHit[]; events: ('bare' | 'green' | 'regrow' | 'swipe' | 'lines' | 'pulled' | 'stunned' | 'healing' | 'phase3')[] } {
  const out = { hits: [] as FinalHit[], events: [] as ('bare' | 'green' | 'regrow' | 'swipe' | 'lines' | 'pulled' | 'stunned' | 'healing' | 'phase3')[] };
  const F = FINAL;
  const alive = targets.filter((t) => !t.dead);
  // The trail burns whoever stands in it, whatever the phase.
  b.trail = b.trail.filter((p) => (p.t -= dt) > 0);
  for (const t of alive) if (b.trail.some((p) => Math.hypot(p.x - t.x, p.z - t.z) <= F.trailR)) out.hits.push({ name: t.name, dmg: F.trailDps * dt, kind: 'trail' });
  if (b.hp <= 0) {
    b.deadFor += dt;
    return out;
  }
  if (b.phase === 1) {
    b.stagger = Math.max(0, b.stagger - dt);
    if (b.catching > 0) {
      b.catching = Math.max(0, b.catching - dt);
      if (b.catching <= 1e-9) {
        b.catching = 0;
        b.bare = F.bareFor;
        out.events.push('bare');
      }
    } else if (b.bare > 0) {
      b.bare = Math.max(0, b.bare - dt);
      if (b.bare <= 1e-9) {
        b.bare = 0;
        b.green = F.greenFor;
        out.events.push('regrow');
      }
    } else if (b.green > 0) {
      b.green = Math.max(0, b.green - dt);
      if (b.green <= 1e-9) {
        b.green = 0;
        out.events.push('green');
      }
    }
    // Root lines land on their own time.
    if (b.linesTell > 0) {
      b.linesTell = Math.max(0, b.linesTell - dt);
      if (b.linesTell <= 1e-9) {
        b.linesTell = 0;
        for (const t of alive) if (b.lines.some((l) => segDist(t.x, t.z, l) <= F.lineHalf)) out.hits.push({ name: t.name, dmg: F.lineDamage, kind: 'line' });
        b.lines = [];
      }
    }
    if (b.stagger > 0) {
      b.anim = 'idle';
      return out;
    }
    const near = alive.filter((t) => Math.hypot(t.x - b.x, t.z - b.z) <= F.swipeReach);
    if (b.swipeTell > 0) {
      b.swipeTell = Math.max(0, b.swipeTell - dt);
      if (b.swipeTell <= 1e-9) {
        b.swipeTell = 0;
        for (const t of near) out.hits.push({ name: t.name, dmg: F.swipeDamage, kind: 'swipe' });
      }
    } else {
      b.swipeIn -= dt;
      if (b.swipeIn <= 1e-9 && near.length) {
        b.swipeIn = F.swipeEvery;
        b.swipeTell = F.swipeTell;
        b.anim = 'attack';
        const t = near[0]!;
        b.yaw = Math.atan2(t.x - b.x, t.z - b.z);
        out.events.push('swipe');
      }
    }
    b.linesIn -= dt;
    if (b.linesIn <= 1e-9 && b.linesTell <= 0 && alive.length) {
      b.linesIn = F.linesEvery;
      b.linesTell = F.linesTell;
      const angles = alive.slice(0, F.lineCount).map((t) => Math.atan2(t.x - b.x, t.z - b.z));
      while (angles.length < F.lineCount) angles.push(rng() * Math.PI * 2);
      b.lines = angles.map((a) => ({ x0: b.x + Math.sin(a) * F.body, z0: b.z + Math.cos(a) * F.body, x1: b.x + Math.sin(a) * F.lineLen, z1: b.z + Math.cos(a) * F.lineLen }));
      out.events.push('lines');
    }
    if (b.swipeTell <= 0) b.anim = 'idle';
    return out;
  }
  if (b.phase === 2) {
    for (const br of b.brotes) {
      if (br.steps === 0) continue;
      br.openFor = Math.max(0, br.openFor - dt);
      if (br.openFor <= 1e-9) br.steps = 0; // it closes again
    }
    const p = b.pull;
    if (p) {
      const who = alive.find((t) => t.name === p.name);
      const br = b.brotes[p.i]!;
      if (!who || Math.hypot(who.x - br.x, who.z - br.z) > F.pullReach || br.broken) b.pull = null;
      else if ((p.left -= dt) <= 1e-9) {
        b.pull = null;
        out.events.push(breakBrote(b, p.i) === 'phase3' ? 'phase3' : 'pulled');
      }
    }
    return out;
  }
  // Phase 3: the body is frozen; the core runs, comes back to heal, leaves a trail.
  const c = b.core;
  if (!c || c.hp <= 0) return out;
  if (c.stun > 0) {
    c.stun = Math.max(0, c.stun - dt);
    c.anim = 'idle';
    return out;
  }
  const move = (tx: number, tz: number, speed: number) => {
    const dx = tx - c.x;
    const dz = tz - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return 0;
    const s = Math.min(d, speed * dt);
    c.x += (dx / d) * s;
    c.z += (dz / d) * s;
    c.yaw = Math.atan2(dx, dz);
    return d - s;
  };
  if (c.mode === 'heal') {
    c.anim = 'idle';
    c.hp = Math.min(c.max, c.hp + c.max * F.healRate * dt);
    b.hp = b.max * F.p3At * (c.hp / c.max);
    if (c.hp >= c.max) {
      c.mode = 'run';
      c.returnIn = F.returnEvery;
    }
    return out;
  }
  c.anim = 'run';
  if (c.mode === 'back') {
    if (move(b.x, b.z, F.coreSpeed) <= F.body + 0.2) {
      c.mode = 'heal';
      out.events.push('healing');
    }
  } else {
    c.returnIn -= dt;
    if (c.returnIn <= 1e-9) c.mode = 'back';
    const threat = alive.reduce<WolfTarget | null>((a, t) => (!a || Math.hypot(t.x - c.x, t.z - c.z) < Math.hypot(a.x - c.x, a.z - c.z) ? t : a), null);
    if (threat) {
      // Run away from the nearest fighter, bending along the Copa's wall.
      let ax = c.x - threat.x;
      let az = c.z - threat.z;
      const ox = c.x - b.x;
      const oz = c.z - b.z;
      const r = Math.hypot(ox, oz);
      if (r > F.coreRoom - 3) {
        // Near the wall: slide sideways (tangent), the side that leads away.
        const tx = -oz / r;
        const tz = ox / r;
        const s = tx * ax + tz * az >= 0 ? 1 : -1;
        ax = tx * s;
        az = tz * s;
      }
      const d = Math.hypot(ax, az) || 1;
      move(c.x + (ax / d) * 5, c.z + (az / d) * 5, F.coreSpeed);
    }
  }
  const r = Math.hypot(c.x - b.x, c.z - b.z);
  if (r > F.coreRoom) {
    c.x = b.x + ((c.x - b.x) / r) * F.coreRoom;
    c.z = b.z + ((c.z - b.z) / r) * F.coreRoom;
  }
  const hitP = pillars.find((p) => !c.stoppedBy.includes(p.id) && Math.hypot(p.x - c.x, p.z - c.z) <= F.pillarR);
  if (hitP) {
    c.stoppedBy.push(hitP.id);
    c.stun = F.stunFor;
    if (c.mode === 'back') c.mode = 'run';
    out.events.push('stunned');
  }
  c.trailIn -= dt;
  if (c.trailIn <= 0) {
    c.trailIn = F.trailEvery;
    b.trail.push({ x: c.x, z: c.z, t: F.trailLife });
  }
  return out;
}
