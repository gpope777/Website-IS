import { describe, expect, it } from 'vitest';
import { InterpBuffer, lerpAngle } from './interp';

const s = (t: number, x: number, yaw = 0) => ({ t, x, y: 0, z: 0, yaw });

describe('InterpBuffer', () => {
  it('interpolates between samples', () => {
    const b = new InterpBuffer();
    b.push(s(1, 0));
    b.push(s(2, 10));
    expect(b.at(1.5)!.x).toBeCloseTo(5);
  });

  it('holds the ends instead of extrapolating', () => {
    const b = new InterpBuffer();
    b.push(s(1, 0));
    b.push(s(2, 10));
    expect(b.at(0)!.x).toBe(0);
    expect(b.at(5)!.x).toBe(10);
    expect(new InterpBuffer().at(1)).toBeNull();
  });

  it('ignores out-of-order samples', () => {
    const b = new InterpBuffer();
    b.push(s(2, 10));
    b.push(s(1, 0));
    expect(b.at(1)!.x).toBe(10);
  });

  it('turns the short way around', () => {
    expect(Math.abs(lerpAngle(3.1, -3.1, 0.5))).toBeGreaterThan(3.1);
  });
});
