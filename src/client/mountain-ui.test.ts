import { describe, expect, it } from 'vitest';
import { quartzAction } from './mountain-ui';

describe('quartzAction', () => {
  const veins = [{ id: 0, x: 10, y: 50, z: -300 }, { id: 1, x: 40, y: 45, z: -320 }];
  it('offers a ripe vein you are up beside', () => {
    expect(quartzAction({ x: 10.5, y: 50, z: -300 }, veins, [])).toEqual({ t: 'quartz', id: 0, label: 'Picar cuarzo' });
  });
  it('not while it regrows, not from below, not from afar', () => {
    expect(quartzAction({ x: 10.5, y: 50, z: -300 }, veins, [0])).toBeNull();
    expect(quartzAction({ x: 10.5, y: 44, z: -300 }, veins, [])).toBeNull();
    expect(quartzAction({ x: 14, y: 50, z: -300 }, veins, [])).toBeNull();
  });
});
