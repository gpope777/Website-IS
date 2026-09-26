import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { HALF, WATER_LEVEL } from '../shared/terrain';
import { ColliderGrid } from './colliders';
import { animFor, createBody, PLAYER_RADIUS, SPEED, stepBody, type MoveInput } from './movement';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const none = () => [];
const fwd: MoveInput = { x: 0, z: -1, sprint: false, jump: false };

function run(input: MoveInput, seconds: number, terrain = flat, nearby: Parameters<typeof stepBody>[5] = none, yaw = 0) {
  const b = createBody(0, 0, terrain);
  let r = stepBody(b, input, yaw, 0, terrain, nearby);
  for (let t = 0; t < seconds; t += 1 / 60) r = stepBody(b, input, yaw, 1 / 60, terrain, nearby);
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
