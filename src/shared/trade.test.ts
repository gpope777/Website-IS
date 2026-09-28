import { describe, expect, it } from 'vitest';
import { ITEMS, type Inventory } from './items';
import { linesOk, offerInv, trade, TRADE, type TradeLine } from './shop';

describe('trueque, reglas puras (T6-C)', () => {
  it('linesOk: up to 3 distinct materials, integers 1–99', () => {
    expect(linesOk([])).toBe(true);
    expect(linesOk([{ item: 'pearl', n: 3 }, { item: 'wood', n: 99 }, { item: 'amber', n: 1 }])).toBe(true);
    expect(linesOk([{ item: 'pearl', n: 1 }, { item: 'wood', n: 1 }, { item: 'amber', n: 1 }, { item: 'stone', n: 1 }])).toBe(false);
    expect(linesOk([{ item: 'pearl', n: 1 }, { item: 'pearl', n: 2 }])).toBe(false);
    for (const n of [0, 100, 1.5, -1, '3']) expect(linesOk([{ item: 'pearl', n }])).toBe(false);
    for (const item of ['rank', 'hat', 'weaponLvl', 'savia', '__proto__']) expect(linesOk([{ item, n: 1 }])).toBe(false);
    expect(linesOk('x')).toBe(false);
    expect(linesOk([null])).toBe(false);
    expect(TRADE.lines).toBe(3);
  });

  it('offerInv merges lines', () => {
    expect(offerInv([{ item: 'pearl', n: 2 }, { item: 'wood', n: 5 }])).toEqual({ pearl: 2, wood: 5 });
  });

  it('swaps, gifts, and refuses a short side without touching anything', () => {
    const a: Inventory = { pearl: 3, wood: 1 };
    const b: Inventory = { berries: 10 };
    const r = trade(a, b, [{ item: 'pearl', n: 2 }], [{ item: 'berries', n: 6 }]);
    expect(r).toEqual({ ok: true, a: { pearl: 1, wood: 1, berries: 6 }, b: { berries: 4, pearl: 2 } });
    expect(a).toEqual({ pearl: 3, wood: 1 });
    expect(b).toEqual({ berries: 10 });
    const g = trade(a, b, [{ item: 'wood', n: 1 }], []);
    expect(g.ok && g.b.wood).toBe(1);
    expect(trade(a, b, [{ item: 'pearl', n: 4 }], [])).toEqual({ ok: false, side: 0, item: 'pearl' });
    expect(trade(a, b, [], [{ item: 'berries', n: 11 }])).toEqual({ ok: false, side: 1, item: 'berries' });
  });

  it('property: totals kept; both sides change by the whole offers or not at all', () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const inv = (): Inventory => Object.fromEntries(ITEMS.filter(() => rnd() < 0.6).map((k) => [k, Math.floor(rnd() * 12)]));
    const lines = (): TradeLine[] => {
      const pool = [...ITEMS].sort(() => rnd() - 0.5).slice(0, Math.floor(rnd() * 4));
      return pool.map((item) => ({ item, n: 1 + Math.floor(rnd() * 10) }));
    };
    for (let i = 0; i < 500; i++) {
      const a = inv();
      const b = inv();
      const la = lines();
      const lb = lines();
      const r = trade(a, b, la, lb);
      const oa = offerInv(la);
      const ob = offerInv(lb);
      for (const k of ITEMS) {
        const na = r.ok ? (r.a[k] ?? 0) : (a[k] ?? 0);
        const nb = r.ok ? (r.b[k] ?? 0) : (b[k] ?? 0);
        expect(na + nb).toBe((a[k] ?? 0) + (b[k] ?? 0));
        expect(na).toBeGreaterThanOrEqual(0);
        expect(nb).toBeGreaterThanOrEqual(0);
        if (r.ok) expect(na).toBe((a[k] ?? 0) - (oa[k] ?? 0) + (ob[k] ?? 0));
      }
    }
  });
});
