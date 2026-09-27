import { describe, expect, it } from 'vitest';
import type { TradeView } from '../shared/protocol';
import { addLine, bumpLine, cycleLine, tradeHtml, tradeTarget } from './trade-ui';

const view = (o: Partial<TradeView> = {}): TradeView => ({ with: 'Bea', asker: true, open: true, mine: [], theirs: [], okMine: false, okTheirs: false, ...o });

describe('ventana de trueque (T6-C)', () => {
  it('tradeTarget: nearest standing player within 4 m', () => {
    const others = [
      { name: 'Bea', x: 3, z: 0 },
      { name: 'Cai', x: 2, z: 0, down: true },
      { name: 'Dan', x: 5, z: 0 },
    ];
    expect(tradeTarget({ x: 0, z: 0 }, others)).toBe('Bea');
    expect(tradeTarget({ x: -2, z: 0 }, others)).toBeNull();
  });

  it('asked, waiting and open views', () => {
    const asked = tradeHtml(view({ asker: false, open: false, with: 'Ana' }), {});
    expect(asked).toContain('Ana quiere cambiar.');
    expect(asked).toContain('data-a="yes"');
    expect(asked).toContain('data-a="no"');
    const wait = tradeHtml(view({ open: false }), {});
    expect(wait).toContain('Esperando a Bea…');
    expect(wait).toContain('data-a="cancel"');
    const open = tradeHtml(view({ mine: [{ item: 'pearl', n: 2 }], theirs: [{ item: 'berries', n: 6 }], okTheirs: true }), { pearl: 3, wood: 1 });
    expect(open).toContain('Tú das');
    expect(open).toContain('Bea da');
    expect(open).toContain('6 bayas');
    expect(open).toContain('data-a="inc-0"');
    expect(open).toContain('data-a="del-0"');
    expect(open).toContain('data-a="add"');
    expect(open).toContain('Bea: Vale.');
    expect(open).toMatch(/data-a="ok">Vale/);
    const done = tradeHtml(view({ okMine: true }), {});
    expect(done).toContain('Nada.');
    expect(done).toMatch(/data-a="ok" disabled/);
    expect(done).not.toContain('data-a="add"');
  });

  it('line helpers: add, cycle, bump stay within what you have', () => {
    const inv = { wood: 3, pearl: 2, amber: 1 };
    expect(addLine([], inv)).toEqual([{ item: 'wood', n: 1 }]);
    const three = [{ item: 'wood', n: 1 }, { item: 'pearl', n: 1 }, { item: 'amber', n: 1 }] as const;
    expect(addLine([...three], { ...inv, stone: 4 })).toBeNull();
    expect(addLine([...three], inv)).toBeNull();
    expect(cycleLine([{ item: 'wood', n: 3 }], 0, inv)).toEqual([{ item: 'pearl', n: 2 }]);
    expect(cycleLine([{ item: 'wood', n: 1 }, { item: 'pearl', n: 1 }], 0, inv)).toEqual([{ item: 'amber', n: 1 }, { item: 'pearl', n: 1 }]);
    expect(bumpLine([{ item: 'pearl', n: 2 }], 0, 1, inv)).toEqual([{ item: 'pearl', n: 2 }]);
    expect(bumpLine([{ item: 'pearl', n: 2 }], 0, -5, inv)).toEqual([{ item: 'pearl', n: 1 }]);
  });
});
