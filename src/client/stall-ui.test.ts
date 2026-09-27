import { describe, expect, it } from 'vitest';
import { newStall } from '../shared/shop';
import { nextItem, stallAction, stallHtml } from './stall-ui';

describe('stall panel (T6-A)', () => {
  it('shows the four shelves and the owner buttons', () => {
    const s = newStall(1, 'Ana', 0, 0, 0, 0);
    s.shelves[0] = { ...s.shelves[0]!, give: 'pearl', n: 1, want: 'berries', m: 6, stock: 3 };
    const h = stallHtml(s, { berries: 2 });
    expect(h).toContain('Puesto de Ana');
    expect(h).toContain('Vendo 1 perlas por 6 bayas · quedan 3');
    expect(h).toContain('Vendo 1 madera por 1 bayas · quedan 0');
    for (const a of ['give-0', 'n-0-dec', 'n-0-inc', 'want-3', 'm-3-dec', 'm-3-inc', 'stock-2', 'take-1', 'pick', 'back']) expect(h).toContain(`data-a="${a}"`);
    expect(h).toContain('data-a="stock-0" disabled'); // no pearls in the mochila
    expect(h).toContain('data-a="take-1" disabled'); // empty shelf
    expect(h).not.toContain('data-a="take-0" disabled');
  });

  it('nextItem cycles the 7 materials', () => {
    expect(nextItem('wood')).toBe('stone');
    expect(nextItem('thorn')).toBe('wood');
  });

  it('stallAction: nearest within 4 m, own or not', () => {
    const a = newStall(1, 'Ana', 0, 0, 0, 0);
    const b = newStall(2, 'Bea', 20, 0, 0, 0);
    expect(stallAction({ x: 3, z: 0 }, [a, b], 'Ana')).toEqual({ own: true, s: a });
    expect(stallAction({ x: 19, z: 0 }, [a, b], 'Ana')).toEqual({ own: false, s: b });
    expect(stallAction({ x: 10, z: 0 }, [a, b], 'Ana')).toBeNull();
  });
});
