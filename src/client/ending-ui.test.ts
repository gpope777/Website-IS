import { describe, expect, it } from 'vitest';
import { endingSteps, guardianAction, guardianLine, raidsMenu } from './ending-ui';
import { GUARDIAN_LINES } from '../shared/ending';
import { RIM_LINE } from '../shared/corrupt-lands';
import { createBody, stepBody } from './movement';
import { createTerrain } from '../shared/terrain';

describe('ending UI (S5-G)', () => {
  it('four 5 s cards then the 25 s credits', () => {
    const s = endingSteps(['a', 'b', 'c', 'd'], ['Bosque', 'Ana']);
    expect(s.map((x) => x.ms)).toEqual([5000, 5000, 5000, 5000, 25000]);
    expect(s[4]).toMatchObject({ credits: true, lines: ['Bosque', 'Ana'] });
  });

  it('el Guardián talks within 3 m of his spot, only after the ending; his lines cycle', () => {
    const heart = { x: 10, z: 0 };
    expect(guardianAction({ x: 18, z: 1 }, heart, true)).toEqual({ label: 'Hablar con el Guardián' });
    expect(guardianAction({ x: 18, z: 1 }, heart, false)).toBeNull();
    expect(guardianAction({ x: 10, z: 0 }, heart, true)).toBeNull();
    expect(guardianLine(0)).toBe(GUARDIAN_LINES[0]);
    expect(guardianLine(6)).toBe(GUARDIAN_LINES[0]);
  });

  it('the raids toggle shows at the Heart after the ending and asks for the opposite', () => {
    expect(raidsMenu(false, true, false)).toBeNull();
    expect(raidsMenu(true, false, false)).toBeNull();
    expect(raidsMenu(true, true, false)).toEqual({ label: 'Noches de asedio: encendidas', on: false });
    expect(raidsMenu(true, true, true)).toEqual({ label: 'Noches de asedio: apagadas', on: true });
  });

  it('a walker crosses the rim at x 0 only with la Grieta open', () => {
    const t = createTerrain(42);
    const walk = (grieta: boolean) => {
      const b = createBody(0, RIM_LINE + 0.3, t);
      b.grieta = grieta;
      for (let i = 0; i < 10; i++) stepBody(b, { x: 0, z: -1, sprint: false, jump: false }, 0, 0.05, t, () => []);
      return b.z < RIM_LINE;
    };
    expect(walk(false)).toBe(false);
    expect(walk(true)).toBe(true);
  });
});
