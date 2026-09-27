import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { HALF, WATER_LEVEL } from '../shared/terrain';
import { ColliderGrid } from './colliders';
import type { Crag } from '../shared/crags';
import { animFor, createBody, PLAYER_RADIUS, rollInput, SPEED, STAMINA, stepBody, type Body, type MoveInput } from './movement';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const none = () => [];
const fwd: MoveInput = { x: 0, z: -1, sprint: false, jump: false };

function run(input: MoveInput, seconds: number, terrain = flat, nearby: Parameters<typeof stepBody>[5] = none, yaw = 0, crags: Crag[] = [], b: Body = createBody(0, 0, terrain)) {
  let r = stepBody(b, input, yaw, 0, terrain, nearby, crags);
  for (let t = 0; t < seconds; t += 1 / 60) r = stepBody(b, input, yaw, 1 / 60, terrain, nearby, crags);
  return { b, r };
}

describe('stepBody', () => {
  it('moves forward (-z) relative to the camera at walking speed', () => {
    const { b, r } = run(fwd, 2);
    expect(b.z).toBeLessThan(-5);
    expect(Math.abs(b.x)).toBeLessThan(1e-6);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.walk, 1);
    expect(animFor(r, b)).toBe('walk');
    expect(b.facing).toBeCloseTo(Math.PI, 5); // atan2(0, -1)
  });

  it('turns with the camera', () => {
    const { b } = run(fwd, 1, flat, none, Math.PI / 2); // camera looking -x
    expect(b.x).toBeLessThan(-2);
  });

  it('sprints faster', () => {
    const { b, r } = run({ ...fwd, sprint: true }, 2);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.run, 1);
    expect(animFor(r, b)).toBe('run');
  });

  it('is pushed out of colliders', () => {
    const grid = new ColliderGrid();
    grid.add('tree', { x: 0, z: -3, r: 0.5 });
    const { b } = run(fwd, 3, flat, (x, z) => grid.near(x, z));
    expect(Math.hypot(b.x, b.z + 3)).toBeGreaterThanOrEqual(0.5 + PLAYER_RADIUS - 1e-3);
  });

  it('jumps and lands', () => {
    const b = createBody(0, 0, flat);
    stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, flat, none);
    expect(b.onGround).toBe(false);
    for (let i = 0; i < 120; i++) stepBody(b, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, flat, none);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(0);
  });

  it('swims in deep water', () => {
    const lake: Terrain = { heightAt: () => -10, density: () => 0.5 };
    const { b, r } = run(fwd, 0.5, lake);
    expect(r.swimming).toBe(true);
    expect(b.y).toBe(WATER_LEVEL - 0.9);
    expect(animFor(r, b)).toBe('swim');
  });

  it('stays inside the world', () => {
    const b = createBody(HALF - 3.5, 0, flat);
    for (let i = 0; i < 120; i++) stepBody(b, { x: 1, z: 0, sprint: true, jump: false }, 0, 1 / 60, flat, none);
    expect(b.x).toBeLessThanOrEqual(HALF - 3);
  });
});

describe('ColliderGrid', () => {
  it('finds neighbours across cells and forgets removed ones', () => {
    const g = new ColliderGrid(8);
    g.add('a', { x: 7.9, z: 0, r: 1 });
    expect(g.near(8.1, 0)).toHaveLength(1);
    expect(g.near(40, 0)).toHaveLength(0);
    g.remove('a');
    expect(g.near(8.1, 0)).toHaveLength(0);
  });
});

describe('rollInput', () => {
  it('runs along the facing whatever the camera does', () => {
    for (const [facing, cam] of [[0, 0], [1, -2], [Math.PI - 0.2, 0.5]] as const) {
      const b = createBody(0, 0, flat);
      stepBody(b, rollInput(facing, cam), cam, 0.1, flat, none);
      expect(Math.atan2(b.x, b.z)).toBeCloseTo(facing);
    }
  });
});

describe('climbing', () => {
  const crag: Crag = { id: 0, x: 0, z: -3, r: 2, base: -1, top: 8 };
  const idle: MoveInput = { x: 0, z: 0, sprint: false, jump: false };

  it('pushing into a crag grabs it and climbs up, spending stamina', () => {
    const { b, r } = run(fwd, 1, flat, none, 0, [crag]);
    expect(b.climb).toBe(crag);
    expect(b.y).toBeGreaterThan(1);
    expect(b.stamina).toBeLessThan(STAMINA.max);
    expect(r.climbing).toBe(true);
    expect(animFor(r, b)).toBe('climb');
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeCloseTo(crag.r + PLAYER_RADIUS, 3);
  });

  it('climbs over the top and stands on it', () => {
    const { b } = run(fwd, 0.2, flat, none, 0, [crag]);
    for (let i = 0; i < 600 && b.climb; i++) stepBody(b, fwd, 0, 1 / 60, flat, none, [crag]);
    expect(b.climb).toBeNull();
    expect(b.y).toBeCloseTo(crag.top);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeLessThan(crag.r);
    const after = run(idle, 1, flat, none, 0, [crag], b).b;
    expect(after.y).toBeCloseTo(crag.top); // stays up there
  });

  it('lets go when stamina runs out, and stays tired until the meter is full', () => {
    const b = createBody(0, 0, flat);
    b.stamina = 5;
    run(fwd, 1.5, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.tired).toBe(true);
    run(idle, 2, flat, none, 0, [crag], b); // fall to the ground
    expect(b.onGround).toBe(true);
    run(fwd, 0.5, flat, none, 0, [crag], b); // tired: bumps into the rock, no grab
    expect(b.climb).toBeNull();
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeGreaterThanOrEqual(crag.r + PLAYER_RADIUS - 1e-3);
    run(idle, STAMINA.max / STAMINA.regen + 0.2, flat, none, 0, [crag], b);
    expect(b.tired).toBe(false);
    expect(b.stamina).toBe(STAMINA.max);
  });

  it('jump leaps off the wall', () => {
    const { b } = run(fwd, 1, flat, none, 0, [crag]);
    const before = b.stamina;
    run({ ...idle, jump: true }, 0.3, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.stamina).toBeLessThan(before - STAMINA.leap + 1);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeGreaterThan(crag.r + PLAYER_RADIUS + 0.5);
  });

  it('strafing circles the crag at the same distance', () => {
    const { b } = run(fwd, 0.5, flat, none, 0, [crag]);
    const a0 = Math.atan2(b.x - crag.x, b.z - crag.z);
    run({ ...idle, x: 1 }, 1, flat, none, 0, [crag], b);
    expect(b.climb).toBe(crag);
    expect(Math.atan2(b.x - crag.x, b.z - crag.z)).toBeGreaterThan(a0 + 0.3);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeCloseTo(crag.r + PLAYER_RADIUS, 3);
  });

  it('climbing down to the foot puts you back on the ground', () => {
    const { b } = run(fwd, 1, flat, none, 0, [crag]);
    run({ ...idle, z: 1 }, 2, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(0);
  });
});
