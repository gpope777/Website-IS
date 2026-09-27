import { ESTRELLA } from '../shared/estrella';
import { inLookout } from '../shared/ending';
import { clampMap, WATER_LEVEL, waterLevel, type Islet, type Terrain } from '../shared/terrain';
import { FISH, fishFloor, fishStepOk } from '../shared/fish';
import { FROG, frogHop, frogMoveOk } from '../shared/frog';
import { DRAGON, dragonCeil, inFog } from '../shared/dragon';
import { rimCrossBlocked } from '../shared/corrupt-lands';
import { seatOffset, WHALE, whaleStepOk } from '../shared/whale';
import { cragTopAt, type Crag } from '../shared/crags';
import type { Anim } from '../shared/protocol';
import { MOUNT } from '../shared/mount';
import { CIENAGA, deepStepOk, inCienaga } from '../shared/coast';
import { BOG, inBog, ZARZAL, zarzalAt } from '../shared/swamp';
import { climbableAt, slopeAt, smoothAt, STEEP, steepBlocked } from '../shared/mountains';
import { inMountains } from '../shared/terrain';
import { VIENTO } from '../shared/viento';
import { inChute, slideDir, snowAt, SNOWSLIDE } from '../shared/snowslide';

/** Camera-relative: x = strafe right, z = back (so forward is -1). Magnitude ≤ 1 after normalising. */
export interface MoveInput {
  x: number;
  z: number;
  sprint: boolean;
  jump: boolean;
}

export interface Body {
  /** The Zarzal knot burnt (from the snapshot): its gap no longer slows. */
  thornsOpen?: boolean;
  /** S5-G: la Grieta is open (the ending, from the snapshot): walkers cross el Borde in it. */
  grieta?: boolean;
  /** S5-H: the steed is la Estrella (faster). */
  star?: boolean;
  /** S5-H: el Árbol-torre's top is open (after the ending). */
  lookout?: boolean;
  /** S5-H: la corriente: left the top and hasn't landed yet (the glider is free). */
  corriente?: boolean;
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
  /** Climbing the mountain's own steep rock (S4-B), not a crag. */
  wall: boolean;
  /** Today's mountain weather wets the rock (set by the game from the seed): no grabbing. */
  wet?: boolean;
  gliding: boolean;
  /** Jump was held last step (glider/leap need a fresh press). */
  jumpHeld: boolean;
  /** On the deer (from the server): faster, no climbing, gliding or swimming. */
  riding: boolean;
  /** On the giant fish (from the server): the dungeon island, whose aguas bravas the fish avoids. */
  fish: Islet | null;
  /** Piloting the whale (from the server): the body is the pilot seat; surface only, 3 m of water. */
  whale: boolean;
  /** On the frog (from the server): land and water ≤ 2 m, B = high jump. */
  frog: boolean;
  /** Seconds until the frog can jump again. */
  hopCd: number;
  /** On the dragon (from the server, S4-G): B held climbs, released sinks, within a band over the ground. */
  dragon?: boolean;
  /** A raid near the Heart: the dragon keeps DRAGON.noLandY up (the server refuses lower). */
  noLand?: boolean;
  /** S5-A: the muro de niebla lets this flier through (open, or ready for a rider with the 4 Raíces-madre). */
  fogPass?: boolean;
  /** On your belly down the snow (S4-H tobogán). */
  sliding?: boolean;
  /** Seconds the slide has been on a flat (< SNOWSLIDE.stopDeg) off the chute. */
  flatFor?: number;
  /** Metres of Viento lift still to rise, and whether this flight already used its lift. */
  lift: number;
  boosted: boolean;
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
  /** Las Montañas refused an uphill step (for a toast): smooth rock, the deer, or just too steep. */
  steep?: 'smooth' | 'deer' | 'steep' | 'wet' | 'rim';
  /** On your belly down the snow (S4-H). */
  sliding?: boolean;
}

export const SPEED = { walk: 3.8, run: 7.5, swim: 2.2, swimFast: 4 } as const;
export const PLAYER_RADIUS = 0.45;
export const STAMINA = { max: 100, regen: 30, climbMove: 10, climbHold: 3, leap: 20, glide: 4, swimFast: 12, perOrb: 20 } as const;
/** Glide speed stays under the server's MAX_SPEED (9 m/s). */
export const GLIDE = { speed: 7, sink: 1.6, minHeight: 1.5 } as const;
/** Metres per second up/down (and around) a crag. */
export const CLIMB_SPEED = 2.2;
/** Mountain rock (S4-B): off the wall you slide down slopes over 45° at `speed`; climbing, you stand up below `stand`°. */
export const SLIDE = { speed: 4, stand: 35 } as const;
/** Deeper than this you swim (the sea, or el Lago Negro's own surface, S5-C). */
const swimDepth = (t: Terrain, x: number, z: number) => waterLevel(t, x, z) - 0.6;
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
    x, y: Math.max(terrain.heightAt(x, z), swimDepth(terrain, x, z)), z, vx: 0, vz: 0, vy: 0, onGround: true, facing: 0,
    stamina: STAMINA.max, staminaMax: STAMINA.max, tired: false, climb: null, wall: false, gliding: false, jumpHeld: false, riding: false, fish: null, whale: false, frog: false, hopCd: 0, lift: 0, boosted: false,
  };
}

/** Rise speed while a Viento lift lasts (the server allows the climb for VIENTO.boostFor s). */
const LIFT_SPEED = 12;

/** A Viento gust while gliding lifts you VIENTO.boost metres, once per flight. False when it does not apply. */
export function boost(b: Body): boolean {
  if (!b.gliding || b.boosted) return false;
  b.boosted = true;
  b.lift = VIENTO.boost;
  return true;
}

const RESULT_IDLE: StepResult = { moving: false, running: false, swimming: false, climbing: false, gliding: false };

function spend(b: Body, amount: number): void {
  b.stamina = Math.max(0, b.stamina - amount);
  if (b.stamina === 0) b.tired = true;
}

/** Where a step from (px,pz) toward (nx,nz) may end: the map edge by default, the dungeon walls inside it. */
export type Bounds = (px: number, pz: number, nx: number, nz: number) => { x: number; z: number };
const mapBounds: Bounds = (_px, _pz, nx, nz) => clampMap(nx, nz, 3);

export function stepBody(
  b: Body,
  input: MoveInput,
  camYaw: number,
  dt: number,
  terrain: Terrain,
  nearby: (x: number, z: number) => Circle[],
  crags: readonly Crag[] = [],
  bounds: Bounds = mapBounds,
): StepResult {
  const jumpEdge = input.jump && !b.jumpHeld;
  b.jumpHeld = input.jump;
  if (b.climb) return stepClimb(b, input, dt, terrain, jumpEdge);
  if (b.wall) return stepWall(b, input, dt, terrain, jumpEdge, bounds);
  if (b.fish) return stepFish(b, b.fish, input, camYaw, dt, terrain, bounds);
  if (b.whale) return stepWhale(b, input, camYaw, dt, terrain, bounds);
  if (b.dragon) return stepDragon(b, input, camYaw, dt, terrain, bounds);
  if (b.frog) return stepFrog(b, input, camYaw, dt, terrain, nearby, crags, bounds, jumpEdge);
  if (b.sliding && !b.riding) return stepSlide(b, input, camYaw, dt, terrain, nearby, crags, bounds, jumpEdge);

  const hereH = terrain.heightAt(b.x, b.z);
  const swimming = hereH < swimDepth(terrain, b.x, b.z);
  if (swimming || b.onGround || b.riding) b.gliding = false;
  else if (jumpEdge) {
    // A fresh jump press in the air toggles the glider (B on touch).
    const below = Math.max(hereH, swimDepth(terrain, b.x, b.z), cragTopAt(crags, b.x, b.z, b.y) ?? -Infinity);
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
  // El tobogán (S4-H): B while running on steep snow throws you on your belly instead of jumping.
  if (jumpEdge && running && b.onGround && !b.riding && !b.tired && snowAt(terrain, b.x, b.z) && slopeAt(terrain, b.x, b.z) > SNOWSLIDE.startDeg) {
    Object.assign(b, { sliding: true, flatFor: 0, gliding: false });
    return stepSlide(b, input, camYaw, dt, terrain, nearby, crags, bounds, false);
  }
  const swimFast = swimming && input.sprint && moving && !b.tired;
  const wading = !b.riding && b.onGround && inCienaga(b.x, b.z);
  const base = b.riding ? (b.star ? (input.sprint ? ESTRELLA.run : ESTRELLA.walk) : input.sprint ? MOUNT.run : MOUNT.walk) : b.gliding ? GLIDE.speed : swimFast ? SPEED.swimFast : swimming ? SPEED.swim : wading ? CIENAGA.speed : running ? SPEED.run : SPEED.walk;
  // El Zarzal holds walkers and deer to a crawl; the swamp's bog slows walkers (the server checks both).
  const grounded = b.onGround && !swimming;
  const speed = grounded && zarzalAt(terrain, b.x, b.z, b.thornsOpen) ? Math.min(base, ZARZAL.speed) : grounded && !b.riding && inBog(terrain, b.x, b.z) ? base * BOG.k : base;

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
    if (!cr.bare && !b.riding && !swimming && !b.tired && moving && (wx * -dx + wz * -dz) / d > 0.5 * Math.hypot(wx, wz)) {
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
  const to = bounds(b.x, b.z, nx, nz);
  if (b.riding && terrain.heightAt(to.x, to.z) < swimDepth(terrain, to.x, to.z)) {
    // The deer will not swim: it stops at the shore.
    to.x = b.x;
    to.z = b.z;
    b.vx = b.vz = 0;
  } else if (swimming && !deepStepOk(terrain, b.x, b.z, to.x, to.z)) {
    // Past 4 m of sea the current turns you back (the server checks the same).
    to.x = b.x;
    to.z = b.z;
    b.vx = b.vz = 0;
  }
  const steep = steepStop(terrain, b, to, !b.riding && !swimming && !b.tired && moving);
  if (b.wall) return { ...RESULT_IDLE, moving: true, climbing: true };
  b.x = to.x;
  b.z = to.z;
  if (moving) b.facing = Math.atan2(wx, wz);
  if (b.onGround && !swimming) slide(terrain, b, dt, bounds);

  const terrainH = terrain.heightAt(b.x, b.z);
  if (terrainH < swimDepth(terrain, b.x, b.z)) {
    b.y = waterLevel(terrain, b.x, b.z) - 0.9;
    b.vy = 0;
    b.onGround = true;
    b.boosted = false;
    b.lift = 0;
    if (swimFast) spend(b, STAMINA.swimFast * dt);
    else regen(b, dt);
    return { ...RESULT_IDLE, moving, swimming: true };
  }
  const ground = Math.max(terrainH, swimDepth(terrain, b.x, b.z), cragTopAt(crags, b.x, b.z, b.y) ?? -Infinity);
  if (input.jump && b.onGround) {
    b.vy = JUMP_SPEED;
    b.onGround = false;
  }
  if (b.onGround && Math.abs(b.y - terrainH) < 0.5) b.corriente = !!b.lookout && inLookout(b.x, b.z); // touched ground: on the top it starts, anywhere else it ends
  if (b.gliding && !b.corriente) {
    spend(b, STAMINA.glide * dt);
    if (b.tired) b.gliding = false;
  }
  if (b.gliding) b.vy = -GLIDE.sink;
  else b.vy -= GRAVITY * dt;
  if (b.lift > 0) {
    const up = Math.min(b.lift, LIFT_SPEED * dt);
    b.lift -= up;
    b.y += up;
  }
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
    b.boosted = false;
    b.lift = 0;
    regen(b, dt);
  }
  return { ...RESULT_IDLE, moving, running, gliding: b.gliding, steep };
}

/**
 * Las Montañas: an uphill step onto a cell over 45° whose ground is above your feet is refused (the server allows 50°).
 * Mid-air too, so a jump that hits a riser falls back instead of snapping onto it. Stops the body in place.
 */
function steepStop(terrain: Terrain, b: Body, to: { x: number; z: number }, grab = false): StepResult['steep'] {
  if (rimCrossBlocked(b.z, to.z, to.x, !!b.grieta)) {
    to.z = b.z; // el Borde (S5): only flying crosses it
    b.vz = Math.max(0, b.vz);
    return 'rim';
  }
  if (terrain.heightAt(to.x, to.z) <= b.y || !steepBlocked(terrain, b.x, b.z, to.x, to.z)) return undefined;
  const wet = !!b.wet;
  const kind = smoothAt(to.x, to.z) ? 'smooth' : b.riding ? 'deer' : wet ? 'wet' : 'steep';
  to.x = b.x;
  to.z = b.z;
  b.vx = b.vz = 0;
  if (grab && b.onGround && climbableAt(to.x, to.z, wet)) {
    // S4-B: pushing into dry mountain rock grabs it.
    Object.assign(b, { wall: true, gliding: false, onGround: false, vy: 0 });
    return undefined;
  }
  return kind;
}

/** Uphill unit vector and slope tangent at (x, z). */
function uphill(terrain: Terrain, x: number, z: number): { ux: number; uz: number; tan: number } {
  const gx = terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z);
  const gz = terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5);
  const tan = Math.hypot(gx, gz);
  return tan < 1e-6 ? { ux: 0, uz: 0, tan: 0 } : { ux: gx / tan, uz: gz / tan, tan };
}

/** Standing on mountain rock over 45° without holding on: slide down it (no damage). */
function slide(terrain: Terrain, b: Body, dt: number, bounds: Bounds): void {
  if (!inMountains(b.x, b.z) || slopeAt(terrain, b.x, b.z) <= STEEP.deg) return;
  const u = uphill(terrain, b.x, b.z);
  // Only when the rock falls away under your feet (not at the foot of a riser, where only the probe touches it).
  if (terrain.heightAt(b.x, b.z) - terrain.heightAt(b.x - u.ux * 0.5, b.z - u.uz * 0.5) < 0.5) return;
  const to = bounds(b.x, b.z, b.x - u.ux * SLIDE.speed * dt, b.z - u.uz * SLIDE.speed * dt);
  b.x = to.x;
  b.z = to.z;
}

/** On mountain rock: stick forward/back = up/down the slope, strafe = along it. B lets go backwards. */
function stepWall(b: Body, input: MoveInput, dt: number, terrain: Terrain, jumpEdge: boolean, bounds: Bounds): StepResult {
  const u = uphill(terrain, b.x, b.z);
  const moving = Math.hypot(input.x, input.z) > 0.01;
  spend(b, (moving ? STAMINA.climbMove : STAMINA.climbHold) * dt);
  if (jumpEdge || b.tired || b.wet) {
    b.wall = false;
    b.onGround = false;
    b.vx = b.vz = b.vy = 0;
    if (jumpEdge && !b.tired && !b.wet) {
      spend(b, STAMINA.leap);
      b.vx = -u.ux * LEAP.out;
      b.vz = -u.uz * LEAP.out;
      b.vy = LEAP.up;
    }
    return RESULT_IDLE;
  }
  const up = -Math.max(-1, Math.min(1, input.z));
  const side = Math.max(-1, Math.min(1, input.x));
  // Facing uphill (ux, uz), "right" is (−uz, ux). Horizontal step so the speed along the surface is CLIMB_SPEED.
  const k = (CLIMB_SPEED * dt) / Math.sqrt(1 + u.tan * u.tan);
  const to = bounds(b.x, b.z, b.x + (u.ux * up - u.uz * side) * k, b.z + (u.uz * up + u.ux * side) * k);
  if (inMountains(to.x, to.z) && !smoothAt(to.x, to.z)) {
    b.x = to.x;
    b.z = to.z;
  }
  b.vx = b.vz = b.vy = 0;
  if (u.tan > 1e-6) b.facing = Math.atan2(u.ux, u.uz);
  const h = Math.max(terrain.heightAt(b.x, b.z), swimDepth(terrain, b.x, b.z));
  const slope = slopeAt(terrain, b.x, b.z);
  const ahead = slopeAt(terrain, b.x + u.ux, b.z + u.uz);
  if ((slope < SLIDE.stand && ahead < STEEP.deg) || (up <= 0 && slope < STEEP.deg) || !inMountains(b.x, b.z)) {
    // Over the top (or back on gentle ground): stand up.
    Object.assign(b, { wall: false, y: h, onGround: true });
    return { ...RESULT_IDLE, moving };
  }
  b.y = h + 0.4;
  return { ...RESULT_IDLE, moving, climbing: true };
}

/** On the fish: water only, 9 m/s (14 sprinting, no stamina); B held dives to the seabed, release floats up. */
function stepFish(b: Body, island: Islet, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, bounds: Bounds): StepResult {
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const speed = input.sprint ? FISH.run : FISH.walk;
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;
  const k = Math.min(1, 4 * dt);
  b.vx += (wx * speed - b.vx) * k;
  b.vz += (wz * speed - b.vz) * k;
  const to = bounds(b.x, b.z, b.x + b.vx * dt, b.z + b.vz * dt);
  if (fishStepOk(terrain, island, to.x, to.z)) {
    b.x = to.x;
    b.z = to.z;
  } else b.vx = b.vz = 0; // the shore, the Ciénaga or the aguas bravas: the fish turns back
  if (moving) b.facing = Math.atan2(wx, wz);
  const surface = waterLevel(terrain, b.x, b.z) - 0.9;
  const floor = Math.min(surface, fishFloor(terrain, b.x, b.z));
  b.y = input.jump ? Math.max(floor, b.y - FISH.sink * dt) : Math.min(surface, b.y + FISH.rise * dt);
  b.y = Math.max(floor, b.y);
  Object.assign(b, { vy: 0, onGround: true, gliding: false, climb: null, wall: false });
  regen(b, dt);
  return { ...RESULT_IDLE, moving, swimming: true };
}

/** On the frog: 8 m/s (11 sprinting, no stamina), the bog does not slow it, water up to 2 m; B = high jump. */
function stepFrog(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, nearby: (x: number, z: number) => Circle[], crags: readonly Crag[], bounds: Bounds, jumpEdge: boolean): StepResult {
  b.hopCd = Math.max(0, b.hopCd - dt);
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;
  if (b.onGround) {
    // El Zarzal still holds it to a crawl (the server checks the same).
    const speed = zarzalAt(terrain, b.x, b.z, b.thornsOpen) ? ZARZAL.speed : input.sprint ? FROG.run : FROG.walk;
    const k = Math.min(1, 12 * dt);
    b.vx += (wx * speed - b.vx) * k;
    b.vz += (wz * speed - b.vz) * k;
    if (moving) b.facing = Math.atan2(wx, wz);
    if (jumpEdge && b.hopCd === 0) {
      const hop = frogHop(GRAVITY);
      b.vy = hop.vy;
      b.vx = Math.sin(b.facing) * hop.fwd;
      b.vz = Math.cos(b.facing) * hop.fwd;
      b.onGround = false;
      b.hopCd = FROG.hop.cd;
    }
  }
  let nx = b.x + b.vx * dt;
  let nz = b.z + b.vz * dt;
  for (const o of [...nearby(nx, nz), ...crags.filter((cr) => b.y < cr.top - 0.6)]) {
    const dx = nx - o.x;
    const dz = nz - o.z;
    const d = Math.hypot(dx, dz);
    const min = PLAYER_RADIUS + o.r;
    if (d < min && d > 1e-4) {
      nx = o.x + (dx / d) * min;
      nz = o.z + (dz / d) * min;
    }
  }
  const to = bounds(b.x, b.z, nx, nz);
  const steep = steepStop(terrain, b, to);
  if (frogMoveOk(terrain, b, to, !b.onGround, crags)) {
    b.x = to.x;
    b.z = to.z;
  } else b.vx = b.vz = 0; // too deep for the frog (it may still hop over, land on a pad, or float back shallower)
  const ground = Math.max(terrain.heightAt(b.x, b.z), waterLevel(terrain, b.x, b.z), cragTopAt(crags, b.x, b.z, b.y) ?? -Infinity);
  if (b.onGround) b.y = ground;
  else {
    b.vy -= GRAVITY * dt;
    const ny = b.y + b.vy * dt;
    if (ny <= ground) {
      b.y = ground;
      b.vy = 0;
      b.onGround = true;
    } else b.y = ny;
  }
  Object.assign(b, { gliding: false, climb: null, wall: false });
  regen(b, dt);
  return { ...RESULT_IDLE, moving, running: input.sprint && moving, steep };
}

/**
 * The tobogán: downhill (south in the chute) with the stick bending it up to ±30°, ramping to 14 m/s, hugging the ground.
 * Ends on B, on a tree or rock (a stop, no damage), off snow, or after 1 s on a flat outside the chute.
 */
function stepSlide(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, nearby: (x: number, z: number) => Circle[], crags: readonly Crag[], bounds: Bounds, jumpEdge: boolean): StepResult {
  const stop = (): StepResult => {
    Object.assign(b, { sliding: false, flatFor: 0, vx: 0, vz: 0 });
    return { ...RESULT_IDLE };
  };
  if (jumpEdge) return stop();
  const d = slideDir(terrain, b.x, b.z);
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = input.x * c + input.z * s;
  const wz = -input.x * s + input.z * c;
  // The stick's sideways part (relative to downhill) bends the slide, never more than `steer`.
  const lat = Math.max(-1, Math.min(1, d.z * wx - d.x * wz));
  const a = lat * SNOWSLIDE.steer;
  const dx = d.x * Math.cos(a) + d.z * Math.sin(a);
  const dz = d.z * Math.cos(a) - d.x * Math.sin(a);
  const sp = Math.min(SNOWSLIDE.speed, Math.hypot(b.vx, b.vz) + SNOWSLIDE.accel * dt);
  b.vx = dx * sp;
  b.vz = dz * sp;
  const to = bounds(b.x, b.z, b.x + b.vx * dt, b.z + b.vz * dt);
  if (nearby(to.x, to.z).some((o) => Math.hypot(to.x - o.x, to.z - o.z) < PLAYER_RADIUS + o.r)) return stop();
  if (crags.some((cr) => cr.top > b.y + 0.6 && Math.hypot(to.x - cr.x, to.z - cr.z) < PLAYER_RADIUS + cr.r)) return stop();
  b.x = to.x;
  b.z = to.z;
  b.facing = Math.atan2(dx, dz);
  b.y = terrain.heightAt(b.x, b.z);
  Object.assign(b, { vy: 0, onGround: true, gliding: false, climb: null, wall: false });
  if (!snowAt(terrain, b.x, b.z)) return stop();
  b.flatFor = !inChute(b.x, b.z) && slopeAt(terrain, b.x, b.z) < SNOWSLIDE.stopDeg ? (b.flatFor ?? 0) + dt : 0;
  if (b.flatFor >= SNOWSLIDE.stopAfter) return stop();
  return { ...RESULT_IDLE, moving: true, sliding: true };
}

/** On the dragon: 15 m/s along the stick, B held climbs, released sinks; ceiling ground + 35 (y ≤ 120); never into the fog. */
function stepDragon(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, bounds: Bounds): StepResult {
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;
  const k = Math.min(1, 4 * dt);
  b.vx += (wx * DRAGON.fly - b.vx) * k;
  b.vz += (wz * DRAGON.fly - b.vz) * k;
  if (moving) b.facing = Math.atan2(wx, wz);
  const to = bounds(b.x, b.z, b.x + b.vx * dt, b.z + b.vz * dt);
  if (inFog(to.z, !!b.fogPass)) {
    b.vz = Math.max(0, b.vz); // the muro de niebla: north is closed
    to.z = b.z;
  }
  b.x = to.x;
  b.z = to.z;
  const ground = Math.max(terrain.heightAt(b.x, b.z), waterLevel(terrain, b.x, b.z));
  const floor = b.noLand ? ground + DRAGON.noLandY : ground;
  const ceil = dragonCeil(ground);
  let y = b.y + (input.jump ? DRAGON.climb : -DRAGON.sink) * dt;
  if (input.jump && y > ceil) y = b.y > ceil ? b.y - DRAGON.sink * dt : ceil; // at the ceiling: hold; above it (off a cliff): sink
  b.y = Math.max(y, floor);
  b.vy = 0;
  b.onGround = b.y <= ground + 0.01;
  Object.assign(b, { gliding: false, climb: null, wall: false });
  regen(b, dt);
  return { ...RESULT_IDLE, moving };
}

/** Piloting the whale: 5 m/s (7 sprinting), on the surface, never where the sea is under 3 m (aguas bravas are fine). */
function stepWhale(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, bounds: Bounds): StepResult {
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const speed = input.sprint ? WHALE.run : WHALE.walk;
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;
  const k = Math.min(1, 1.5 * dt); // heavy: slow to get going
  b.vx += (wx * speed - b.vx) * k;
  b.vz += (wz * speed - b.vz) * k;
  const facing = moving ? Math.atan2(wx, wz) : b.facing;
  const to = bounds(b.x, b.z, b.x + b.vx * dt, b.z + b.vz * dt);
  const off = seatOffset(0, facing);
  if (whaleStepOk(terrain, to.x - off.x, to.z - off.z)) {
    b.x = to.x;
    b.z = to.z;
    b.facing = facing;
  } else b.vx = b.vz = 0; // "La ballena no cabe"
  Object.assign(b, { y: WATER_LEVEL, vy: 0, onGround: true, gliding: false, climb: null, wall: false });
  regen(b, dt);
  return { ...RESULT_IDLE, moving };
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
  const foot = Math.max(terrain.heightAt(b.x, b.z), swimDepth(terrain, b.x, b.z));
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
  if (r.sliding) return 'slide';
  if (r.swimming) return 'swim';
  if (!b.onGround) return 'jump';
  if (!r.moving) return 'idle';
  return r.running ? 'run' : 'walk';
}
