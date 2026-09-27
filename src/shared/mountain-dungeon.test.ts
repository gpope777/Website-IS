import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, inMountains } from './terrain';
import { boulders, clampMountainDungeon, DBLOCKS_SOLUTION, dungeonBlockCell, inMountainDungeon, inRockfall, mountainEntrance, MOUNTAIN_DUNGEON as M, rockfallLane, shelfCrag } from './mountain-dungeon';
import { clampStep, inAnyDungeon, inDungeon, withDungeon } from './dungeon';
import { inSwampDungeon } from './swamp-dungeon';
import { blocksSolved, pushBlock, type Cell } from './mountain-shrines';
import { MOUNTAIN_ZONES } from './corruption';

const X = M.x;
const shut = [false, false, false, false];

describe('mountain dungeon', () => {
  it('is its own interior with a flat floor', () => {
    expect(X).toBe(HALF + 600);
    expect(inMountainDungeon(X, M.entryZ)).toBe(true);
    expect(inDungeon(X, M.entryZ) || inSwampDungeon(X, M.entryZ)).toBe(false);
    expect(inAnyDungeon(X, 40)).toBe(true);
    const t = withDungeon(createTerrain(3));
    expect(t.heightAt(X + 5, 100)).toBe(M.floor);
  });

  it('walls and gates clamp; clampStep delegates', () => {
    expect(clampMountainDungeon(X, 30, X, 34, shut).z).toBeCloseTo(M.gatesZ[0] - 0.5);
    expect(clampMountainDungeon(X, 30, X, 34, [true, false, false, false]).z).toBe(34);
    expect(clampMountainDungeon(X, 10, X + 40, 10, shut).x).toBeCloseTo(X + M.halfW - 0.5);
    expect(clampStep(X, 30, X, 34, [], [], [], shut).z).toBeCloseTo(M.gatesZ[0] - 0.5);
  });

  it('has a climbable 3 m shelf for the high plate', () => {
    const s = shelfCrag();
    expect(s.top).toBe(M.floor + 3);
    expect(s.bare).toBeUndefined();
  });

  it('solves the block room in 5 pushes', () => {
    let b: Cell[] = M.blocks.starts.map((c) => [c[0], c[1]] as const);
    expect(blocksSolved(b, M.blocks.slots)).toBe(false);
    for (const m of DBLOCKS_SOLUTION) {
      const n = pushBlock(b, m.i, m.dir, M.blocks.n);
      expect(n).not.toBeNull();
      b = n!;
    }
    expect(DBLOCKS_SOLUTION).toHaveLength(5);
    expect(blocksSolved(b, M.blocks.slots)).toBe(true);
    const c = dungeonBlockCell([2, 2]);
    expect(c).toEqual({ x: X, z: M.blocks.z });
  });

  it('rolls boulders down lanes; a pillar stops its lane', () => {
    expect(inRockfall(X, 100)).toBe(true);
    expect(rockfallLane(X)).toBe(1);
    expect(rockfallLane(X - 8)).toBe(0);
    expect(boulders(0, 0, [])).toEqual([M.rockfall[1]]);
    expect(boulders(1, 0, [])).toContain(M.rockfall[1] - M.roll);
    const t = 4;
    const free = boulders(t, 0, []);
    expect(free.some((z) => z < 110)).toBe(true);
    const shielded = boulders(t, 0, [{ x: X - 8, z: 110 }]);
    expect(shielded.every((z) => z >= 110)).toBe(true);
    expect(boulders(t, 0, [{ x: X + 8, z: 110 }])).toEqual(free);
  });

  it('opens 5 m north of the mountain root', () => {
    const e = mountainEntrance();
    expect(e.x).toBe(MOUNTAIN_ZONES.rootX);
    expect(e.z).toBe(-HALF - MOUNTAIN_ZONES.rootD - 5);
    expect(inMountains(e.x, e.z)).toBe(true);
  });
});
