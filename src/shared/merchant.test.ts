import { describe, expect, it } from 'vitest';
import { ITEMS, type Inventory } from './items';
import { NAMES } from './names';
import { biomeItem, biomeRestock, buy, canDeliver, collectTill, deliver, MERCHANT, merchantDeal, newStall, RARE, restock, setShelf, stallGoods, STALL, takeShelf, type ShopResult, type Stall } from './shop';
import { HALF } from './terrain';

const ok = (r: ShopResult) => {
  if (!r.ok) throw new Error(r.why);
  return r;
};
const fresh = () => newStall(1, 'Ana', 0, 0, 0, 0);

describe('el Buhonero (T6-D)', () => {
  it('names', () => {
    expect(NAMES.merchant).toBe('Buhonero');
    expect(NAMES.order).toBe('Encargo');
  });

  it('never gives a rare material; buys every material', () => {
    for (const d of MERCHANT.deals) expect(RARE).not.toContain(d.get);
    for (const k of ITEMS) expect(MERCHANT.deals.some((d) => d.give === k || k === 'berries')).toBe(true);
    expect(MERCHANT.perDay).toBe(20);
  });

  it('no cycle through him gains anything', () => {
    // sell X for bayas then buy X back with those bayas: never more X than you started with
    for (const s of MERCHANT.deals.filter((d) => d.get === 'berries')) {
      for (const b of MERCHANT.deals.filter((d) => d.give === 'berries' && d.get === s.give)) {
        // per unit of X: bayas got / X given, then X got / bayas given
        expect((s.m / s.n) * (b.m / b.n)).toBeLessThan(1);
      }
    }
  });

  it('merchantDeal applies exactly one row, or nothing', () => {
    const inv: Inventory = { wood: 7 };
    const r = merchantDeal(inv, 0, 0);
    expect(r).toEqual({ ok: true, inv: { wood: 2, berries: 1 } });
    expect(inv).toEqual({ wood: 7 });
    expect(merchantDeal({ wood: 4 }, 0, 0)).toEqual({ ok: false, why: 'No te llega: madera.' });
    expect(merchantDeal({ wood: 9 }, 0, 20)).toEqual({ ok: false, why: 'Por hoy ya está.' });
    for (const id of [-1, 9, 1.5, NaN]) expect(merchantDeal({ wood: 9 }, id, 0).ok).toBe(false);
  });

  it('biomeItem', () => {
    expect(biomeItem(0, 0)).toBe('berries');
    expect(biomeItem(0, HALF + 50)).toBe('pearl');
    expect(biomeItem(-HALF - 50, 100)).toBe('amber');
    expect(biomeItem(0, -HALF - 30)).toBe('quartz');
    expect(biomeItem(0, -HALF - 400)).toBe('thorn');
  });

  it('biomeRestock: +1 on the first matching Vendo shelf, up to 10, rare needs found', () => {
    let s = ok(setShelf(fresh(), 1, 'quartz', 1, 'berries', 3, {})).stall;
    s = { ...s, x: 0, z: -HALF - 30 };
    expect(biomeRestock(s, [])).toBeNull();
    const r = biomeRestock(s, ['quartz'])!;
    expect(r.shelves[1]!.stock).toBe(1);
    expect(s.shelves[1]!.stock).toBe(0);
    const full = { ...s, shelves: s.shelves.map((sh, i) => (i === 1 ? { ...sh, stock: 10 } : sh)) };
    expect(biomeRestock(full, ['quartz'])).toBeNull();
    const busco = { ...s, shelves: s.shelves.map((sh, i) => (i === 1 ? { ...sh, mode: 'want' as const } : sh)) };
    expect(biomeRestock(busco, ['quartz'])).toBeNull();
    const forest = ok(setShelf(fresh(), 0, 'berries', 1, 'wood', 1, {})).stall;
    expect(biomeRestock(forest, [])!.shelves[0]!.stock).toBe(1);
    const wrong = ok(setShelf(fresh(), 0, 'quartz', 1, 'wood', 1, {})).stall;
    expect(biomeRestock(wrong, ['quartz'])).toBeNull();
  });

  it('Busco: mode only on an empty shelf, at most two', () => {
    let s = fresh();
    s = ok(setShelf(s, 0, 'stone', 12, 'quartz', 3, {}, 'want')).stall;
    expect(s.shelves[0]!.mode).toBe('want');
    s = ok(setShelf(s, 1, 'wood', 5, 'pearl', 1, {}, 'want')).stall;
    expect(setShelf(s, 2, 'wood', 5, 'pearl', 1, {}, 'want')).toEqual({ ok: false, why: 'Solo dos encargos.' });
    s = ok(setShelf(s, 1, 'wood', 5, 'pearl', 1, {}, 'want')).stall; // already Busco: fine
    const stocked = ok(restock(fresh(), 0, { wood: 5 })).stall;
    expect(setShelf(stocked, 0, 'wood', 1, 'berries', 1, {}, 'want')).toEqual({ ok: false, why: 'Quita el género primero.' });
    expect(setShelf(s, 0, 'stone', 12, 'quartz', 3, {}).ok).toBe(true); // no mode: keeps it
    expect(ok(setShelf(s, 0, 'stone', 12, 'quartz', 3, {})).stall.shelves[0]!.mode).toBe('want');
  });

  it('Busco: pay set aside at posting; Entregar pays at once', () => {
    let s = ok(setShelf(fresh(), 0, 'stone', 12, 'quartz', 3, {}, 'want')).stall;
    const r = ok(restock(s, 0, { stone: 30 }));
    expect(r.inv).toEqual({ stone: 18 });
    s = r.stall;
    expect(s.shelves[0]!.stock).toBe(12);
    expect(canDeliver(s, 0, { quartz: 2 })).toBe('No te llega: cuarzo.');
    const d = ok(deliver(s, 0, { quartz: 4 }, 'Bea', 3));
    expect(d.inv).toEqual({ quartz: 1, stone: 12 });
    expect(d.stall.till).toEqual({ quartz: 3 });
    expect(d.stall.shelves[0]!.stock).toBe(0);
    expect(d.stall.log[0]).toEqual({ who: 'Bea', give: 'stone', n: 12, want: 'quartz', m: 3, day: 3 });
    expect(canDeliver(d.stall, 0, { quartz: 4 })).toBe('Ya no paga.');
    expect(buy(s, 0, { quartz: 9 }, 'Bea', 3).ok).toBe(false);
    const sell = ok(restock(fresh(), 0, { wood: 1 })).stall;
    expect(deliver(sell, 0, { berries: 9 }, 'Bea', 3).ok).toBe(false);
    const fullTill: Stall = { ...s, till: { wood: 199 } };
    expect(canDeliver(fullTill, 0, { quartz: 3 })).toBe('Caja llena.');
    expect(ok(takeShelf(s, 0, {})).inv).toEqual({ stone: 12 });
  });

  it('property: totals = start + ledger of Buhonero rows and restocks', () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    const sum = (invs: Inventory[], s: Stall) => {
      const g = stallGoods(s);
      return Object.fromEntries(ITEMS.map((k) => [k, invs.reduce((a, v) => a + (v[k] ?? 0), 0) + (g[k] ?? 0)]));
    };
    for (let run = 0; run < 500; run++) {
      const invs: Inventory[] = [0, 1, 2].map(() => Object.fromEntries(ITEMS.map((k) => [k, Math.floor(rnd() * 40)])));
      let s: Stall = { ...fresh(), x: pick([0, 0]), z: pick([0, -HALF - 30, HALF + 50]) };
      const ledger: Record<string, number> = Object.fromEntries(ITEMS.map((k) => [k, 0]));
      const start = sum(invs, s);
      let used = 0;
      for (let step = 0; step < 60; step++) {
        const w = Math.floor(rnd() * 3);
        const i = Math.floor(rnd() * 4);
        const op = rnd();
        let r: ShopResult | null = null;
        if (op < 0.15) r = setShelf(s, i, pick(ITEMS), 1 + Math.floor(rnd() * 5), pick(ITEMS), 1 + Math.floor(rnd() * 5), invs[0]!, rnd() < 0.5 ? 'want' : rnd() < 0.5 ? 'sell' : undefined);
        else if (op < 0.35) r = restock(s, i, invs[0]!);
        else if (op < 0.42) r = takeShelf(s, i, invs[0]!);
        else if (op < 0.55) r = buy(s, i, invs[w]!, 'x', 1);
        else if (op < 0.7) r = deliver(s, i, invs[w]!, 'x', 1);
        else if (op < 0.75) r = collectTill(s, invs[0]!);
        else if (op < 0.92) {
          const id = Math.floor(rnd() * MERCHANT.deals.length);
          const m = merchantDeal(invs[w]!, id, used);
          if (m.ok) {
            invs[w] = m.inv;
            used++;
            const d = MERCHANT.deals[id]!;
            ledger[d.give] = ledger[d.give]! - d.n;
            ledger[d.get] = ledger[d.get]! + d.m;
          }
          if (rnd() < 0.1) used = 0; // a new day
        } else {
          const b = biomeRestock(s, pick([[], [...RARE]]));
          if (b) {
            s = b;
            ledger[biomeItem(s.x, s.z)] = ledger[biomeItem(s.x, s.z)]! + 1;
          }
        }
        if (r?.ok) {
          s = r.stall;
          const who = op < 0.42 || (op >= 0.7 && op < 0.75) ? 0 : w;
          invs[who] = r.inv;
        }
        const now = sum(invs, s);
        for (const k of ITEMS) expect(now[k]).toBe(start[k]! + ledger[k]!);
        expect(invs.every((v) => Object.values(v).every((n) => Number.isInteger(n) && n! >= 0))).toBe(true);
        expect(s.shelves.filter((sh) => sh.mode === 'want').length).toBeLessThanOrEqual(STALL.wantMax);
        expect(s.shelves.every((sh) => sh.stock >= 0)).toBe(true);
      }
    }
  });
});

