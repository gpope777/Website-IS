import { HALF, WATER_LEVEL, type Terrain } from '../shared/terrain';
import { cragTopAt, type Crag } from '../shared/crags';
import type { Anim } from '../shared/protocol';

/** Camera-relative: x = strafe right, z = back (so forward is -1). Magnitude ≤ 1 after normalising. */
export interface MoveInput {
  x: number;
  z: number;
  sprint: boolean;
  jump: boolean;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  onGround: boolean;
  /** Protocol yaw: atan2(dirX, dirZ). */
  facing: number;
  /** 0..staminaMax. Client-side, like the roll dash. */
  stamina: number;
  /** STAMINA.max plus the shrine orbs (see staminaFor). */
  staminaMax: number;
  /** Ran dry: no climbing, gliding or fast swimming until the meter is full again. */
  tired: boolean;
  /** The crag being climbed, if any. */
  climb: Crag | null;
  gliding: boolean;
  /** Jump was held last step (glider/leap need a fresh press). */
  jumpHeld: boolean;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface StepResult {
  moving: boolean;
  running: boolean;
  swimming: boolean;
  climbing: boolean;
  gliding: boolean;
}

export const SPEED = { walk: 3.8, run: 7.5, swim: 2.2, swimFast: 4 } as const;
export const PLAYER_RADIUS = 0.45;
export const STAMINA = { max: 100, regen: 30, climbMove: 10, climbHold: 3, leap: 20, glide: 4, swimFast: 12, perOrb: 20 } as const;
/** Glide speed stays under the server's MAX_SPEED (9 m/s). */
export const GLIDE = { speed: 7, sink: 1.6, minHeight: 1.5 } as const;
/** Metres per second up/down (and around) a crag. */
export const CLIMB_SPEED = 2.2;
const SWIM_DEPTH = WATER_LEVEL - 0.6;
const GRAVITY = 14;
const JUMP_SPEED = 5.2;
const LEAP = { out: 4, up: 4 } as const;

/** Max stamina with this many upgrade orbs. */
export function staminaFor(orbs: number): number {
  return STAMINA.max + orbs * STAMINA.perOrb;
}

/** Stick input (camera-relative) that moves along `facing`: used for the roll dash. */
export function rollInput(facing: number, camYaw: number): MoveInput {
  return { x: Math.sin(facing - camYaw), z: Math.cos(facing - camYaw), sprint: true, jump: false };
}

export function createBody(x: number, z: number, terrain: Terrain): Body {
  return {
    x, y: Math.max(terrain.heightAt(x, z), SWIM_DEPTH), z, vx: 0, vz: 0, vy: 0, onGround: true, facing: 0,
    stamina: STAMINA.max, staminaMax: STAMINA.max, tired: false, climb: null, gliding: false, jumpHeld: false,
  };
}

const RESULT_IDLE: StepResult = { moving: false, running: false, swimming: false, climbing: false, gliding: false };

function spend(b: Body, amount: number): void {
  b.stamina = Math.max(0, b.stamina - amount);
  if (b.stamina === 0) b.tired = true;
}

export function stepBody(
  b: Body,
  input: MoveInput,
  camYaw: number,
  dt: number,
  terrain: Terrain,
  nearby: (x: number, z: number) => Circle[],
  crags: readonly Crag[] = [],
): StepResult {
  const jumpEdge = input.jump && !b.jumpHeld;
  b.jumpHeld = input.jump;
  if (b.climb) return stepClimb(b, input, dt, terrain, jumpEdge);

  const hereH = terrain.heightAt(b.x, b.z);
  const swimming = hereH < SWIM_DEPTH;
  if (swimming || b.onGround) b.gliding = false;
  else if (jumpEdge) {
    // A fresh jump press in the air toggles the glider (B on touch).
    const below = Math.max(hereH, SWIM_DEPTH, cragTopAt(crags, b.x, b.z, b.y) ?? -Infinity);
    b.gliding = !b.gliding && !b.tired && b.y - below > GLIDE.minHeight;
  }
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const running = input.sprint && moving && !swimming;
  const swimFast = swimming && input.sprint && moving && !b.tired;
  const speed = b.gliding ? GLIDE.speed : swimFast ? SPEED.swimFast : swimming ? SPEED.swim : running ? SPEED.run : SPEED.walk;

  // Camera forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw).
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;

  // The glider keeps drifting along the facing when the stick is idle.
  const dx0 = b.gliding && !moving ? Math.sin(b.facing) : wx;
  const dz0 = b.gliding && !moving ? Math.cos(b.facing) : wz;
  const k = Math.min(1, (b.onGround ? 12 : b.gliding ? 2 : 3) * dt);
  b.vx += (dx0 * speed - b.vx) * k;
  b.vz += (dz0 * speed - b.vz) * k;

  let nx = b.x + b.vx * dt;
  let nz = b.z + b.vz * dt;
  for (const o of nearby(nx, nz)) {
    const dx = nx - o.x;
    const dz = nz - o.z;
    const d = Math.hypot(dx, dz);
    const min = PLAYER_RADIUS + o.r;
    if (d < min && d > 1e-4) {
      const push = (min - d) / d;
      nx += dx * push;
      nz += dz * push;
    }
  }
  for (const cr of crags) {
    if (b.y >= cr.top - 0.6) continue; // on (or level with) the top: walk over it
    const dx = nx - cr.x;
    const dz = nz - cr.z;
    const d = Math.hypot(dx, dz);
    const min = PLAYER_RADIUS + cr.r;
    if (d >= min || d < 1e-4) continue;
    // Pushing the stick at the rock grabs it (fallback B: only marked crags are climbable; bare shrine rocks are not).
    if (!cr.bare && !swimming && !b.tired && moving && (wx * -dx + wz * -dz) / d > 0.5 * Math.hypot(wx, wz)) {
      b.x = cr.x + (dx / d) * min;
      b.z = cr.z + (dz / d) * min;
      b.climb = cr;
      b.gliding = false;
      b.vx = b.vz = b.vy = 0;
      b.onGround = false;
      b.facing = Math.atan2(-dx, -dz);
      return { ...RESULT_IDLE, moving: true, climbing: true };
    }
    nx = cr.x + (dx / d) * min;
    nz = cr.z + (dz / d) * min;
  }
  b.x = Math.max(-HALF + 3, Math.min(HALF - 3, nx));
  b.z = Math.max(-HALF + 3, Math.min(HALF - 3, nz));
  if (moving) b.facing = Math.atan2(wx, wz);

  const terrainH = terrain.heightAt(b.x, b.z);
  if (terrainH < SWIM_DEPTH) {
    b.y = WATER_LEVEL - 0.9;
    b.vy = 0;
    b.onGround = true;
    if (swimFast) spend(b, STAMINA.swimFast * dt);
    else regen(b, dt);
    return { ...RESULT_IDLE, moving, swimming: true };
  }
  const ground = Math.max(terrainH, SWIM_DEPTH, cragTopAt(crags, b.x, b.z, b.y) ?? -Infinity);
  if (input.jump && b.onGround) {
    b.vy = JUMP_SPEED;
    b.onGround = false;
  }
  if (b.gliding) {
    spend(b, STAMINA.glide * dt);
    if (b.tired) b.gliding = false;
  }
  if (b.gliding) b.vy = -GLIDE.sink;
  else b.vy -= GRAVITY * dt;
  const ny = b.y + b.vy * dt;
  if (ny <= ground) {
    b.y = ground;
    b.vy = 0;
    b.onGround = true;
  } else if (b.onGround && b.vy <= 0 && ny - ground < 0.3) {
    b.y = ground; // walking downhill: stick to the slope instead of hopping
    b.vy = 0;
  } else {
    b.y = ny;
    b.onGround = false;
  }
  if (b.onGround) {
    b.gliding = false;
    regen(b, dt);
  }
  return { ...RESULT_IDLE, moving, running, gliding: b.gliding };
}

function regen(b: Body, dt: number): void {
  b.stamina = Math.min(b.staminaMax, b.stamina + STAMINA.regen * dt);
  if (b.stamina === b.staminaMax) b.tired = false;
}

/** On a crag: stick forward/back = up/down, strafe = around it. */
function stepClimb(b: Body, input: MoveInput, dt: number, terrain: Terrain, jumpEdge: boolean): StepResult {
  const c = b.climb!;
  const ring = c.r + PLAYER_RADIUS;
  let ang = Math.atan2(b.x - c.x, b.z - c.z);
  const out = { x: Math.sin(ang), z: Math.cos(ang) };
  const moving = Math.hypot(input.x, input.z) > 0.01;
  spend(b, (moving ? STAMINA.climbMove : STAMINA.climbHold) * dt);

  if (jumpEdge || b.tired) {
    b.climb = null;
    b.onGround = false;
    if (jumpEdge && !b.tired) {
      spend(b, STAMINA.leap);
      b.vx = out.x * LEAP.out;
      b.vz = out.z * LEAP.out;
      b.vy = LEAP.up;
      b.facing = ang;
    } else {
      b.vx = out.x; // slip off
      b.vz = out.z;
      b.vy = 0;
    }
    return RESULT_IDLE;
  }

  b.y -= Math.max(-1, Math.min(1, input.z)) * CLIMB_SPEED * dt;
  // Facing the rock (ang + π), "right" is the direction of increasing angle.
  ang += (Math.max(-1, Math.min(1, input.x)) * CLIMB_SPEED * dt) / ring;
  b.x = c.x + Math.sin(ang) * ring;
  b.z = c.z + Math.cos(ang) * ring;
  b.facing = ang + Math.PI;
  b.vx = b.vz = b.vy = 0;

  if (b.y >= c.top) {
    // Mantle onto the top.
    b.y = c.top;
    b.x = c.x + Math.sin(ang) * (c.r - 0.6);
    b.z = c.z + Math.cos(ang) * (c.r - 0.6);
    b.climb = null;
    b.onGround = true;
    return { ...RESULT_IDLE, moving };
  }
  const foot = Math.max(terrain.heightAt(b.x, b.z), SWIM_DEPTH);
  if (b.y <= foot) {
    b.y = foot;
    b.climb = null;
    b.onGround = true;
    return { ...RESULT_IDLE, moving };
  }
  return { ...RESULT_IDLE, moving, climbing: true };
}

export function animFor(r: StepResult, b: Body): Anim {
  if (r.climbing) return 'climb';
  if (r.gliding) return 'glide';
  if (r.swimming) return 'swim';
  if (!b.onGround) return 'jump';
  if (!r.moving) return 'idle';
  return r.running ? 'run' : 'walk';
}
