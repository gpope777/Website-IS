import { describe, expect, it } from 'vitest';
import { ESTRELLA, estrellaAt, estrellaOut, fullMoon } from './estrella';
import { MOUNT } from './mount';
import { RIM_LINE } from './corrupt-lands';

describe('la Estrella (S5-H)', () => {
  it('a full moon every 8 days', () => {
    expect([0, 8, 16].map(fullMoon)).toEqual([true, true, true]);
    expect(fullMoon(3)).toBe(false);
  });

  it('out only after the ending, at night, under a full moon', () => {
    expect(estrellaOut(8, true, true)).toBe(true);
    expect(estrellaOut(8, false, true)).toBe(false);
    expect(estrellaOut(8, true, false)).toBe(false);
    expect(estrellaOut(9, true, true)).toBe(false);
  });

  it('rolls a 20 m circle in la Ceniza at ~2.4 m/s', () => {
    const c = { x: ESTRELLA.path.dx, z: estrellaAt(0).z };
    const a = estrellaAt(10);
    const b = estrellaAt(11);
    for (const t of [0, 7, 30, 99]) expect(estrellaAt(t).z).toBeLessThan(RIM_LINE);
    expect(Math.hypot(estrellaAt(0).x - c.x, 0)).toBeCloseTo(20);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(2.4, 1);
    // the yaw points along the motion
    expect(Math.sin(a.yaw) * (b.x - a.x) + Math.cos(a.yaw) * (b.z - a.z)).toBeGreaterThan(0);
  });

  it('four rounds, the last harder than the deer’s', () => {
    expect(ESTRELLA.rounds).toHaveLength(4);
    expect(ESTRELLA.rounds[3].width).toBeLessThan(MOUNT.rounds[2].width);
    expect(ESTRELLA.run).toBeGreaterThan(MOUNT.run);
  });
});
