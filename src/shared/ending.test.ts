import { describe, expect, it } from 'vitest';
import { creditLines, ENDING, endingCards, endingWave, GUARDIAN_LINES, guardianSpot, lateCards } from './ending';
import { GRIETA, inGrieta, RIM_LINE, rimCrossBlocked, withGrieta } from './corrupt-lands';
import { NAMES } from './names';
import { CORRUPT_LANDS, createTerrain } from './terrain';

describe('the ending cards and credits (S5-G)', () => {
  it('four cards: the names in the third, el Guardián in the fourth', () => {
    const c = endingCards('Ana y Bea');
    expect(c).toHaveLength(4);
    expect(c[2]).toBe('«Yo también era un bosque… Ana y Bea.»');
    expect(c[3]).toContain(NAMES.guardian);
  });

  it('credits: the game, the names, the drawings and the maker', () => {
    const l = creditLines('Ana y Bea');
    expect(l[0]).toBe('Bosque');
    expect(l).toContain('Ana y Bea');
    expect(l).toContain(`Dibujos: ${NAMES.credits}`);
    expect(l).toContain('Hecho por Gabriel');
  });

  it('late cards say who did it while you slept', () => {
    expect(lateCards('Ana y Bea')[0]).toBe(`Mientras dormías, Ana y Bea vencieron a ${NAMES.villain}.`);
  });

  it('six distinct Guardián lines; he stands 8 m east of the Heart', () => {
    expect(new Set(GUARDIAN_LINES).size).toBe(6);
    expect(guardianSpot({ x: 10, z: -4 })).toEqual({ x: 18, z: -4 });
    expect(ENDING.guardian.h).toBe(3);
  });

  it('post-ending waves are 60 % (at least one)', () => {
    expect(endingWave(10)).toBe(6);
    expect(endingWave(7)).toBe(5);
    expect(endingWave(1)).toBe(1);
  });
});

describe('la Grieta (S5-G)', () => {
  const foot = CORRUPT_LANDS.z1 - CORRUPT_LANDS.rim;
  it('its band straddles the rim line at x 0', () => {
    expect(inGrieta(0, RIM_LINE - 5)).toBe(true);
    expect(inGrieta(0, RIM_LINE + 5)).toBe(true);
    expect(inGrieta(10, RIM_LINE - 5)).toBe(false);
    expect(inGrieta(0, foot - 5)).toBe(false);
  });

  it('closed it is the plain terrain; open it cuts a notch never above the ground, its floor ≤ 31°', () => {
    const base = createTerrain(42);
    let open = false;
    const t = withGrieta(base, () => open);
    for (let z = foot - 10; z < foot + GRIETA.len + 10; z += 3) expect(t.heightAt(0, z)).toBe(base.heightAt(0, z));
    open = true;
    expect(t.heightAt(0, foot)).toBeCloseTo(base.heightAt(0, foot));
    expect(t.heightAt(20, RIM_LINE)).toBe(base.heightAt(20, RIM_LINE));
    let prev = t.heightAt(0, foot);
    let cut = 0;
    for (let z = foot + 1; z <= foot + GRIETA.len; z += 1) {
      const h = t.heightAt(0, z);
      expect(h).toBeLessThanOrEqual(base.heightAt(0, z) + 1e-9);
      if (h < base.heightAt(0, z) - 1) {
        cut++;
        expect((Math.atan2(h - prev, 1) * 180) / Math.PI).toBeLessThan(31); // the cut itself; past it, the mountain's own ground
      }
      prev = h;
    }
    expect(cut).toBeGreaterThan(40); // it really cuts through el Borde
  });

  it('the rim blocks walkers, except inside the open Grieta', () => {
    expect(rimCrossBlocked(RIM_LINE + 1, RIM_LINE - 1)).toBe(true);
    expect(rimCrossBlocked(RIM_LINE + 1, RIM_LINE - 1, 0, false)).toBe(true);
    expect(rimCrossBlocked(RIM_LINE + 1, RIM_LINE - 1, 0, true)).toBe(false);
    expect(rimCrossBlocked(RIM_LINE + 1, RIM_LINE - 1, 10, true)).toBe(true);
  });
});
