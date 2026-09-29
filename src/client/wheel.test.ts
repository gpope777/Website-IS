import { describe, expect, it } from 'vitest';
import { sectorAt } from './wheel';

describe('sectorAt', () => {
  it('respeta zona muerta, empieza arriba y gira en sentido horario', () => {
    expect(sectorAt(0, 0, 4)).toBeNull();
    expect(sectorAt(0, -60, 4)).toBe(0);
    expect(sectorAt(60, 0, 4)).toBe(1);
    expect(sectorAt(0, 60, 4)).toBe(2);
    expect(sectorAt(-60, 0, 4)).toBe(3);
    expect(sectorAt(10, -60, 6)).toBe(0);
    expect(sectorAt(-10, -60, 6)).toBe(0);
  });
});
