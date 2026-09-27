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

describe('Proezas y Libro (P4-D)', () => {
  it('6 feats with names, 11 bosses', async () => {
    const { FEATS, BOSS_KINDS, FEAT_HAT } = await import('./progression');
    expect(FEATS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(NAMES.featNames).toHaveLength(6);
    expect(NAMES.book).toBe('Libro');
    expect(NAMES.feats).toBe('Proezas');
    expect(BOSS_KINDS).toHaveLength(11);
    expect(FEAT_HAT).toEqual({ 1: 7, 4: 8, 6: 9 });
  });

  it('bossesOf: saved plus inferred from powers, no repeats, no junk', async () => {
    const { bossesOf } = await import('./progression');
    expect(bossesOf({ viento: true }).sort()).toEqual(['boss2', 'elite2']);
    expect(bossesOf({ enredadera: true, bosses: ['boss', 'lieut1', 'wolf'] }).sort()).toEqual(['boss', 'elite', 'lieut1']);
    expect(bossesOf({})).toEqual([]);
  });

  it('3 Proeza hats: 7–9, locked until the feat', async () => {
    const { isLook, hatUnlocked, HAT_HINTS, HAT_IDS } = await import('./progression');
    expect(isLook(0, 9)).toBe(true);
    expect(isLook(0, 10)).toBe(false);
    expect(HAT_IDS).toHaveLength(9);
    for (const [h, f] of [[7, 1], [8, 4], [9, 6]] as const) {
      expect(hatUnlocked({}, h)).toBe(false);
      expect(hatUnlocked({ feats: [f] }, h)).toBe(true);
      expect(HAT_HINTS[HAT_IDS[h - 1]!]).toMatch(/Proeza/);
      expect(NAMES.hatNames[HAT_IDS[h - 1]!]).toBeTruthy();
    }
    expect(hatUnlocked({ feats: [2, 3, 5] }, 7)).toBe(false);
  });
});
