import { describe, expect, it } from 'vitest';
import { costText, itemWord, NAMES, qty } from './names';

describe('qty (P7-C)', () => {
  it('singular at 1, plural otherwise', () => {
    expect(qty(1, 'pearl')).toBe('1 perla');
    expect(qty(3, 'pearl')).toBe('3 perlas');
    expect(qty(0, 'pearl')).toBe('0 perlas');
    expect(qty(1, 'berries')).toBe('1 baya');
    expect(qty(6, 'berries')).toBe('6 bayas');
    expect(qty(1, 'quartz')).toBe('1 cuarzo');
    expect(qty(2, 'quartz')).toBe('2 cuarzos');
    expect(qty(1, 'amber')).toBe('1 ámbar');
    expect(qty(2, 'amber')).toBe('2 de ámbar');
    expect(qty(1, 'wood')).toBe('1 madera');
    expect(qty(8, 'wood')).toBe('8 madera');
    expect(qty(4, 'stone')).toBe('4 piedra');
  });
  it('the thorn follows NAMES.thorn', () => {
    expect(qty(1, 'thorn')).toBe(`1 ${NAMES.thorn}`);
    expect(qty(2, 'thorn')).toBe('2 espinas negras');
    expect(itemWord(2, 'thorn')).toBe('espinas negras');
  });
  it('costText uses the item order and skips zeros', () => {
    expect(costText({ wood: 8, stone: 4 })).toBe('8 madera, 4 piedra');
    expect(costText({ pearl: 1, stone: 0, berries: 6 })).toBe('6 bayas, 1 perla');
    expect(costText({})).toBe('');
  });
});
