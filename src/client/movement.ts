import { HALF, WATER_LEVEL, type Terrain } from '../shared/terrain';
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
}

export const SPEED = { walk: 3.8, run: 7.5, swim: 2.2 } as const;
export const PLAYER_RADIUS = 0.45;
const SWIM_DEPTH = WATER_LEVEL - 0.6;
const GRAVITY = 14;
const JUMP_SPEED = 5.2;

export function createBody(x: number, z: number, terrain: Terrain): Body {
  return { x, y: Math.max(terrain.heightAt(x, z), SWIM_DEPTH), z, vx: 0, vz: 0, vy: 0, onGround: true, facing: 0 };
}

export function stepBody(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, nearby: (x: number, z: number) => Circle[]): StepResult {
  const swimming = terrain.heightAt(b.x, b.z) < SWIM_DEPTH;
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const running = input.sprint && moving && !swimming;
  const speed = swimming ? SPEED.swim : running ? SPEED.run : SPEED.walk;

  // Camera forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw).
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;

  const k = Math.min(1, (b.onGround ? 12 : 3) * dt);
  b.vx += (wx * speed - b.vx) * k;
  b.vz += (wz * speed - b.vz) * k;

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
  b.x = Math.max(-HALF + 3, Math.min(HALF - 3, nx));
  b.z = Math.max(-HALF + 3, Math.min(HALF - 3, nz));
  if (moving) b.facing = Math.atan2(wx, wz);

  const terrainH = terrain.heightAt(b.x, b.z);
  if (terrainH < SWIM_DEPTH) {
    b.y = WATER_LEVEL - 0.9;
    b.vy = 0;
    b.onGround = true;
    return { moving, running: false, swimming: true };
  }
  const ground = Math.max(terrainH, SWIM_DEPTH);
  if (input.jump && b.onGround) {
    b.vy = JUMP_SPEED;
    b.onGround = false;
  }
  b.vy -= GRAVITY * dt;
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
  return { moving, running, swimming: false };
}

export function animFor(r: StepResult, b: Body): Anim {
  if (r.swimming) return 'swim';
  if (!b.onGround) return 'jump';
  if (!r.moving) return 'idle';
  return r.running ? 'run' : 'walk';
}
