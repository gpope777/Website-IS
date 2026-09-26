import { describe, expect, it } from 'vitest';
import { addItem, BUILD_COST, count, hasAll, removeAll } from './items';

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
