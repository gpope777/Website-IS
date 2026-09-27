import { describe, expect, it } from 'vitest';
import { keepLock, LOCK, pickTarget, yawTo } from './aim';

const T = [
  { id: 1, x: 0, z: 10 }, // straight ahead (yaw 0 = +z), far
  { id: 2, x: 3, z: 4 }, // ahead-right, close
  { id: 3, x: 0, z: -2 }, // behind, very close
];

describe('pickTarget', () => {
  it('prefers close targets roughly in front and ignores ones behind', () => {
    expect(pickTarget(0, 0, 0, T, 24, Math.PI / 3)).toBe(2);
    expect(pickTarget(0, 0, 0, [T[0]!, T[2]!], 24, Math.PI / 3)).toBe(1);
    expect(pickTarget(0, 0, 0, [T[2]!], 24, Math.PI / 3)).toBeNull();
    expect(pickTarget(0, 0, 0, [T[0]!], 5, Math.PI / 3)).toBeNull();
  });
});

describe('lock', () => {
  it('keeps a lock until the target leaves or dies', () => {
    expect(keepLock(1, 0, 0, T)).toBe(true);
    expect(keepLock(1, 0, 0, [{ id: 1, x: 0, z: LOCK.keep + 1 }])).toBe(false);
    expect(keepLock(9, 0, 0, T)).toBe(false);
  });
  it('yawTo matches protocol yaw', () => {
    expect(yawTo(0, 0, 0, 5)).toBeCloseTo(0);
    expect(yawTo(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2);
  });
});
