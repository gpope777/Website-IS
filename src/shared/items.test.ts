import { describe, expect, it } from 'vitest';
import { addItem, BUILD_COST, count, hasAll, removeAll, STRUCTURE_HP, STRUCTURE_KINDS, TEND_COST } from './items';

describe('inventory', () => {
  it('adds without mutating', () => {
    const a = {};
    const b = addItem(a, 'wood', 3);
    expect(a).toEqual({});
    expect(count(b, 'wood')).toBe(3);
  });

  it('checks and removes build costs', () => {
    const inv = { wood: 6, stone: 3 };
    expect(hasAll(inv, BUILD_COST.campfire)).toBe(true);
    expect(removeAll(inv, BUILD_COST.campfire)).toEqual({ wood: 1 });
    expect(hasAll({ wood: 4 }, BUILD_COST.campfire)).toBe(false);
  });

  it('refuses to go negative', () => {
    expect(() => removeAll({ wood: 1 }, { wood: 2 })).toThrow();
  });
});

describe('aventura structures', () => {
  it('every kind has a cost and HP', () => {
    for (const k of STRUCTURE_KINDS) {
      expect(BUILD_COST[k]).toBeDefined();
      expect(STRUCTURE_HP[k]).toBeGreaterThan(0);
    }
    expect(STRUCTURE_KINDS).toContain('heart');
    expect(STRUCTURE_KINDS).toContain('spikes');
    expect(STRUCTURE_KINDS).toContain('roots');
    expect(BUILD_COST.roots).toEqual({ wood: 4, berries: 2 });
    expect(TEND_COST).toEqual({ berries: 5 });
  });
});

describe('weapon upgrade', () => {
  it('adds 15 % per level, up to 3', async () => {
    const { weaponMult, UPGRADE } = await import('./items');
    expect(weaponMult(0)).toBe(1);
    expect(weaponMult(3)).toBeCloseTo(1.45, 6);
    expect(weaponMult(9)).toBeCloseTo(1.45, 6);
    expect(UPGRADE.cost.pearl).toBe(3);
  });
});

describe('Capa de corteza', () => {
  it('takes 10 % off per level, up to 3, and costs amber', async () => {
    const { capaMult, CAPA, ITEM_LABELS } = await import('./items');
    const { NAMES } = await import('./names');
    expect(capaMult(0)).toBe(1);
    expect(capaMult(3)).toBeCloseTo(0.7, 6);
    expect(capaMult(9)).toBeCloseTo(0.7, 6);
    expect(CAPA.cost).toEqual({ amber: 3, wood: 10, berries: 5 });
    expect(ITEM_LABELS.amber.toLowerCase()).toBe(NAMES.amber);
  });
});
