import { describe, expect, it } from 'vitest';
import { NAMES } from './names';
import { BRANCHES, canLearn, hasSkill, isSkill, SKILL_IDS, SKILL_LINES, skillPoints } from './progression';

describe('Oficios (P4-B)', () => {
  it('12 oficios in 3 branches of 4', () => {
    expect(BRANCHES).toHaveLength(3);
    for (const b of BRANCHES) expect(b.skills).toHaveLength(4);
    expect(new Set(SKILL_IDS).size).toBe(12);
    for (const id of SKILL_IDS) {
      expect(NAMES.skillNames[id]).toBeTruthy();
      expect(SKILL_LINES[id]).toBeTruthy();
    }
    expect(NAMES.skills).toBe('Oficios');
  });

  it('learning goes in order and costs a point', () => {
    expect(canLearn([], 'planeo', 8)).toBe('order');
    expect(canLearn([], 'pies', 1)).toBe('points');
    expect(canLearn(['pies'], 'planeo', 3)).toBe('ok');
    expect(canLearn(['pies'], 'pies', 3)).toBe('owned');
    expect(canLearn(['pies', 'planeo'], 'mano', 3)).toBe('points');
    expect(skillPoints(8, ['pies', 'planeo', 'pulmon', 'trepador', 'mano', 'fogatero', 'amiga'])).toBe(0);
    expect(skillPoints(3)).toBe(2);
  });

  it('hasSkill and isSkill', () => {
    expect(hasSkill(undefined, 'pies')).toBe(false);
    expect(hasSkill({ skills: ['pies'] }, 'pies')).toBe(true);
    expect(isSkill('pastor')).toBe(true);
    expect(isSkill('nope')).toBe(false);
  });
});
