import { describe, expect, it } from 'vitest';
import type { Crag } from './crags';
import { ENREDADERA, planVine } from './enredadera';
import type { Terrain } from './terrain';

const flat: Terrain = { heightAt: () => 1, density: () => 0 };
const rock: Crag = { id: 0, x: 10, z: 0, r: 3, base: 0, top: 12 };
const bare: Crag = { id: 1000, x: -10, z: 0, r: 2.2, base: 0, top: 11, bare: true };

describe('planVine', () => {
  it('grows a new climbable pillar on open ground', () => {
    const v = planVine(flat, [rock], [bare], 0, 0, 2001)!;
    expect(v).toMatchObject({ id: 2001, x: 0, z: 0, r: ENREDADERA.r, top: 1 + ENREDADERA.height });
    expect(v.bare).toBeUndefined();
  });
  it('wraps a bare pillar next to the target, keeping its id and shape', () => {
    expect(planVine(flat, [], [bare], -10 + 3, 0, 2001)).toEqual({ id: 1000, x: -10, z: 0, r: 2.2, base: 0, top: 11 });
  });
  it('refuses water and crowded spots', () => {
    expect(planVine({ heightAt: () => -10, density: () => 0 }, [], [], 0, 0, 1)).toBeNull();
    expect(planVine(flat, [rock], [], 10 - 3.5, 0, 1)).toBeNull();
  });
});
