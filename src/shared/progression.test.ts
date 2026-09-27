import { describe, expect, it } from 'vitest';
import { NAMES } from './names';
import { addKillXp, milestoneXp, nextRankXp, pointsOf, PROGRESS, rankOf, totalXp } from './progression';

describe('progression (P4-A)', () => {
  it('ranks from Savia', () => {
    expect(rankOf(0)).toBe(1);
    expect(rankOf(79)).toBe(1);
    expect(rankOf(80)).toBe(2);
    expect(rankOf(1650)).toBe(8);
    expect(rankOf(99999)).toBe(8);
    expect(pointsOf(8)).toBe(7);
    expect(pointsOf(1)).toBe(0);
    expect(nextRankXp(1)).toBe(80);
    expect(nextRankXp(8)).toBeNull();
  });

  it('milestone Savia comes from the save', () => {
    expect(milestoneXp({})).toBe(0);
    expect(milestoneXp({ shrines: [1, 2, 3], enredadera: true })).toBe(90 + 110);
    const full = { shrines: [...Array(12).keys()], chests: [...Array(6).keys()], enredadera: true, viento: true, fuego: true, piedra: true, steed: { x: 0, z: 0 }, fish: { x: 0, z: 0 }, frog: { x: 0, z: 0 }, dragon: { x: 0, z: 0 }, weaponLvl: 6, capaLvl: 4, ending: true };
    const m = milestoneXp(full);
    expect(m).toBeGreaterThanOrEqual(1200);
    expect(m).toBeLessThanOrEqual(1400);
    expect(rankOf(m)).toBeLessThan(8);
    expect(totalXp({ ...full, xp: 400 })).toBe(m + 400);
    expect(rankOf(totalXp({ ...full, xp: 400 }))).toBe(8);
  });

  it('kill Savia has a daily cap', () => {
    let kd: { day: number; xp: number } | undefined;
    let sum = 0;
    for (let i = 0; i < 45; i++) {
      const r = addKillXp(kd, 3, 'wolf');
      kd = r.killDay;
      sum += r.gain;
    }
    expect(sum).toBe(PROGRESS.killCap);
    expect(addKillXp(kd, 4, 'brute').gain).toBe(3);
    expect(addKillXp(undefined, 0, 'boss').gain).toBe(0);
  });

  it('names', () => {
    expect(NAMES.xp).toBe('Savia');
    expect(NAMES.rank).toBe('Rango');
  });
});
