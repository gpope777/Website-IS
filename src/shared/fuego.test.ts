import { describe, expect, it } from 'vitest';
import { FUEGO, inFlame } from './fuego';

describe('Fuego', () => {
  const up = { x: 0, z: 1 };
  it('burns a short 60° cone', () => {
    expect(inFlame(0, 0, up, 0, 5)).toBe(true);
    expect(inFlame(0, 0, up, 0, 7)).toBe(false);
    expect(inFlame(0, 0, up, Math.sin(0.61) * 4, Math.cos(0.61) * 4)).toBe(false);
    expect(inFlame(0, 0, up, Math.sin(0.4) * 4, Math.cos(0.4) * 4)).toBe(true);
    expect(inFlame(0, 0, up, 0, -3)).toBe(false);
    expect(FUEGO.cooldown).toBe(5);
  });
});
