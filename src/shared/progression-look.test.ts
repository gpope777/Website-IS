import { describe, expect, it } from 'vitest';
import { NAMES } from './names';
import { COLORS, HAT_IDS, hatUnlocked, isLook, PROGRESS, unlockedHats } from './progression';

describe('Aspecto (P4-C)', () => {
  it('8 colours and 9 hats, all named', () => {
    expect(new Set(COLORS).size).toBe(8);
    expect(HAT_IDS).toHaveLength(9) // P4-D: +3 Proeza hats;
    expect(NAMES.look).toBe('Aspecto');
    expect(NAMES.colorNames).toHaveLength(8);
    for (const h of HAT_IDS) expect(NAMES.hatNames[h]).toBeTruthy();
  });
  it('validates a look', () => {
    expect(isLook(0, 0)).toBe(true);
    expect(isLook(7, 6)).toBe(true);
    expect(isLook(8, 0)).toBe(false);
    expect(isLook(1.5, 0)).toBe(false);
    expect(isLook(0, 10)).toBe(false);
    expect(isLook('1', 0)).toBe(false);
  });
  it('unlocks hats with milestones', () => {
    expect(hatUnlocked({}, 0)).toBe(true);
    expect(unlockedHats({})).toEqual([]);
    expect(hatUnlocked({ xp: PROGRESS.ranks[1] }, 1)).toBe(true);
    expect(hatUnlocked({ viento: true }, 2)).toBe(true);
    expect(hatUnlocked({ capaLvl: 2 }, 3)).toBe(false);
    expect(hatUnlocked({ capaLvl: 3 }, 3)).toBe(true);
    expect(hatUnlocked({ piedra: true }, 4)).toBe(true);
    expect(hatUnlocked({ ending: true }, 5)).toBe(true);
    expect(hatUnlocked({ star: true }, 6)).toBe(true);
    expect(hatUnlocked({ star: true }, 5)).toBe(false);
  });
});
