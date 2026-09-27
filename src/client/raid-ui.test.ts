import { describe, expect, it } from 'vitest';
import { raidArrow, raidText } from './raid-ui';

describe('raid ui', () => {
  // Camera yaw 0 looks toward -Z. A raid "dir" is the angle of its origin around the Heart (x = sin, z = cos).
  it('ahead is up, right is right, behind is down', () => {
    expect(raidArrow(Math.PI, 0)).toBe('⬆️');
    expect(raidArrow(Math.PI / 2, 0)).toBe('➡️');
    expect(raidArrow(0, 0)).toBe('⬇️');
    expect(raidArrow(-Math.PI / 2, 0)).toBe('⬅️');
  });
  it('texts per phase', () => {
    expect(raidText(null, 0)).toBeNull();
    expect(raidText({ phase: 'warn', dir: Math.PI, level: 0 }, 0)).toBe('⬆️ Se acerca un asedio');
    expect(raidText({ phase: 'active', dir: Math.PI, level: 2 }, 0)).toBe('⬆️ ¡Asedio! Nivel 2');
  });
});
