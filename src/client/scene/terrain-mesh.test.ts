import { describe, expect, it } from 'vitest';
import { HALF, SOUTH, WORLD_SIZE } from '../../shared/terrain';
import { NEAR_SOUTH, terrainPatches } from './terrain-mesh';

describe('terrainPatches', () => {
  it('covers the whole map: fine to NEAR_SOUTH, half as dense beyond', () => {
    const [near, far] = terrainPatches(200);
    expect(near!.z0).toBe(-HALF);
    expect(near!.z1).toBe(NEAR_SOUTH);
    expect(far!.z0).toBe(NEAR_SOUTH);
    expect(far!.z1).toBe(SOUTH);
    const cellNear = WORLD_SIZE / near!.segX;
    expect((near!.z1 - near!.z0) / near!.segZ).toBeCloseTo(cellNear, 0);
    expect(WORLD_SIZE / far!.segX).toBeCloseTo(cellNear * 2, 5);
    expect((far!.z1 - far!.z0) / far!.segZ).toBeCloseTo(cellNear * 2, 0);
  });
});
