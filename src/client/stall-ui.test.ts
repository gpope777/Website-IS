import { describe, expect, it } from 'vitest';
import { newStall } from '../shared/shop';
import { buyHtml, nextItem, stallAction, stallHtml, stallListHtml } from './stall-ui';

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

  it('buyHtml: stocked shelves with a buy button, greyed with the reason', () => {
    const s = newStall(1, 'Ana', 0, 0, 0, 0);
    s.shelves[0] = { ...s.shelves[0]!, give: 'pearl', n: 1, want: 'berries', m: 6, stock: 3 };
    s.shelves[2] = { ...s.shelves[2]!, give: 'stone', n: 2, want: 'wood', m: 1, stock: 4 };
    const h = buyHtml(s, { berries: 2, wood: 5 });
    expect(h).toContain('Puesto de Ana');
    expect(h).toContain('1 perlas por 6 bayas · quedan 3');
    expect(h).toContain('data-a="buy-0" disabled');
    expect(h).toContain('No te llega: bayas.');
    expect(h).toContain('data-a="buy-2"');
    expect(h).not.toContain('data-a="buy-2" disabled');
    expect(h).not.toContain('buy-1');
    expect(h).toContain('data-a="back"');
    expect(buyHtml(newStall(2, 'Bea', 0, 0, 0, 0), {})).toContain('No vende nada.');
  });

  it('stallHtml shows the Caja, Vaciar caja and the log', () => {
    const s = newStall(1, 'Ana', 0, 0, 0, 0);
    expect(stallHtml(s, {})).toContain('Caja: vacía');
    expect(stallHtml(s, {})).toContain('data-a="till" disabled');
    s.till = { berries: 12 };
    s.log = [{ who: 'Bea', give: 'pearl', n: 1, want: 'berries', m: 6, day: 14 }];
    const h = stallHtml(s, {});
    expect(h).toContain('Caja: 12 bayas');
    expect(h).not.toContain('data-a="till" disabled');
    expect(h).toContain('Bea · 1 perlas · 6 bayas · día 14');
  });

  it('stallListHtml: who, what they sell and where', () => {
    const a = newStall(1, 'Ana', 0, 0, -40, 0);
    a.shelves[0] = { ...a.shelves[0]!, give: 'pearl', stock: 3 };
    a.shelves[1] = { ...a.shelves[1]!, give: 'wood', stock: 1 };
    const b = newStall(2, 'Bea', 30, 0, 0, 0);
    const h = stallListHtml([a, b], { x: 0, z: 0 });
    expect(h).toContain('Puesto de Ana · vende perlas, madera · 40 m al norte');
    expect(h).toContain('Puesto de Bea · no vende nada · 30 m al este');
    expect(stallListHtml([], { x: 0, z: 0 })).toContain('No hay puestos.');
  });
});
