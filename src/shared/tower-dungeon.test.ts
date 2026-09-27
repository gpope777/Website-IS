import { describe, expect, it } from 'vitest';
import { createTerrain, HALF } from './terrain';
import { TOWER } from './corrupt-lands';
import { clampTowerDungeon, columnCrags, inArena, inCopa, inTowerDungeon, insideTower, towerEntrance, towerFloor, towerShelfCrag, TOWER_DUNGEON as T, TOWER_ROCKFALL } from './tower-dungeon';
import { clampStep, inAnyDungeon, withDungeon } from './dungeon';
import { inMountainDungeon, boulders, rockfallLane, MOUNTAIN_DUNGEON as M } from './mountain-dungeon';

const X = T.x;
const shut = [false, false, false, false, false];

describe('tower dungeon (S5-E)', () => {
  it('is its own interior: a corridor and the round Copa, flat floor', () => {
    expect(X).toBe(HALF + 750);
    expect(inTowerDungeon(X, T.entryZ)).toBe(true);
    expect(inTowerDungeon(X, T.copa.z)).toBe(true);
    expect(inTowerDungeon(X + T.halfW + 1, 50)).toBe(false);
    expect(inTowerDungeon(X, T.copa.z + T.copa.r + 1)).toBe(false);
    expect(inMountainDungeon(X, 50)).toBe(false);
    expect(inAnyDungeon(X, 100)).toBe(true);
    expect(withDungeon(createTerrain(3)).heightAt(X + 3, 150)).toBe(T.floor);
    expect(withDungeon(createTerrain(3)).heightAt(X + 15, T.copa.z)).toBe(T.floor);
  });

  it('walls, gates and the Copa clamp; clampStep delegates', () => {
    expect(clampTowerDungeon(X, 16, X, 20, shut).z).toBeCloseTo(T.gatesZ[0] - 0.5);
    expect(clampTowerDungeon(X, 20, X, 16, shut).z).toBeCloseTo(T.gatesZ[0] + 0.5);
    expect(clampTowerDungeon(X, 16, X, 20, [true, false, false, false, false]).z).toBe(20);
    expect(clampTowerDungeon(X, 50, X + 40, 50, shut).x).toBeCloseTo(X + T.halfW - 0.5);
    const c = clampTowerDungeon(X, T.copa.z, X + 40, T.copa.z, shut);
    expect(Math.hypot(c.x - X, c.z - T.copa.z)).toBeCloseTo(T.copa.r - 0.5);
    expect(clampStep(X, 16, X, 20, [], [], [], [], shut).z).toBeCloseTo(T.gatesZ[0] - 0.5);
  });

  it('the door is on the tower’s south face', () => {
    expect(towerEntrance()).toEqual({ x: TOWER.x, z: TOWER.z + TOWER.r });
  });

  it('knows its floors, the arena and the Copa', () => {
    expect(towerFloor(X, 30)).toBe(0);
    expect(towerFloor(X, 70)).toBe(1);
    expect(towerFloor(X, 100)).toBe(2);
    expect(towerFloor(X, 150)).toBe(3);
    expect(towerFloor(X, 181)).toBe(4);
    expect(towerFloor(X, T.stair.z)).toBe(5);
    expect(towerFloor(X, T.copa.z)).toBe(5);
    expect(towerFloor(0, 0)).toBe(-1);
    expect(inArena(X, 181)).toBe(true);
    expect(inArena(X, 150)).toBe(false);
    expect(inCopa(X, T.copa.z)).toBe(true);
    expect(inCopa(X, T.stair.z)).toBe(false);
  });

  it('has a 3 m shelf and four climbable columns', () => {
    const s = towerShelfCrag();
    expect(s.top).toBe(T.floor + 3);
    expect(s).toMatchObject(insideTower(T.shelf));
    const cs = columnCrags();
    expect(cs).toHaveLength(4);
    expect(new Set([...cs.map((c) => c.id), s.id]).size).toBe(5);
    for (const c of cs) expect(inArena(c.x, c.z)).toBe(true);
  });

  it('reuses the rockfall in its own corridor; the mountain’s is unchanged', () => {
    const lane = rockfallLane(X, TOWER_ROCKFALL.x);
    expect(lane).toBe(1);
    expect(boulders(0, 0, [], TOWER_ROCKFALL)[0]).toBeCloseTo(TOWER_ROCKFALL.span[1]);
    expect(boulders(1, 0, [], TOWER_ROCKFALL)[0]).toBeCloseTo(TOWER_ROCKFALL.span[1] - M.roll);
    expect(boulders(1, 0, [{ x: X - 8, z: 145 }], TOWER_ROCKFALL)).toEqual([]);
    expect(boulders(0, 0, [])[0]).toBeCloseTo(M.rockfall[1]);
    expect(rockfallLane(M.x)).toBe(1);
  });
});
