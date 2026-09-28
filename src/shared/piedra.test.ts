import { describe, expect, it } from 'vitest';
import { PIEDRA, pillarSpot, pushDir, structureCrags, TOWER } from './piedra';
import { pushBlock } from './mountain-shrines';

describe('Piedra', () => {
  it('raises 4 m toward the aim, snapped to the 2 m grid', () => {
    expect(pillarSpot(0, 0, 10, 0)).toEqual({ x: 4, z: 0 });
    const s = pillarSpot(0.7, 0.3, 0.7, 20);
    expect(s.x % 2).toBe(0);
    expect(s.z % 2).toBe(0);
    expect(Math.hypot(s.x - 0.7, s.z - 4.3)).toBeLessThanOrEqual(Math.SQRT2 + 1e-9);
  });

  it('pushes away from you along the dominant axis', () => {
    expect(pushDir(0, -1.5, 0, 0)).toEqual([0, 1]);
    expect(pushDir(2, 0.3, 0, 0)).toEqual([-1, 0]);
  });

  it('turns pillars and towers into climbable crags', () => {
    const c = structureCrags([
      { id: 5, kind: 'pillar', x: 1, y: 10, z: 2 },
      { id: 6, kind: 'tower', x: 4, y: 10, z: 2 },
      { id: 7, kind: 'wall', x: 8, y: 10, z: 2 },
    ]);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ id: PIEDRA.cragId + 5, top: 10 + PIEDRA.height, r: PIEDRA.half });
    expect(c[0]!.bare).toBeUndefined();
    expect(c[1]).toMatchObject({ id: PIEDRA.cragId + 6, top: 10 + TOWER.height });
  });

  it('pushBlock takes the grid size', () => {
    expect(pushBlock([[4, 0]], 0, [1, 0], 5)).toBeNull();
    expect(pushBlock([[4, 0]], 0, [1, 0])).toEqual([[5, 0]]);
  });
});
