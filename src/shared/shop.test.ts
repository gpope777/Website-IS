import { describe, expect, it } from 'vitest';
import { ITEMS, type Inventory, type ItemId } from './items';
import { buy, canBuy, canPlaceStall, collectTill, LOG_MAX, newStall, tillTotal, pickUp, restock, setShelf, stallGoods, STALL, takeShelf, type ShopResult, type Stall } from './shop';

const ok = (r: ShopResult) => {
  if (!r.ok) throw new Error(r.why);
  return r;
};
const total = (inv: Inventory, s: Stall) => {
  const g = stallGoods(s);
  return Object.fromEntries(ITEMS.map((k) => [k, (inv[k] ?? 0) + (g[k] ?? 0)]));
};
const fresh = () => newStall(1, 'Ana', 0, 0, 0, 0);

describe('shop rules (T6-A)', () => {
  it('a new stall has 4 empty sell shelves and an empty till', () => {
    const s = fresh();
    expect(s.shelves).toHaveLength(STALL.shelves);
    expect(s.shelves.every((sh) => sh.mode === 'sell' && sh.stock === 0)).toBe(true);
    expect(s.till).toEqual({});
    expect(stallGoods(s)).toEqual({});
    expect(STALL.cost).toEqual({ wood: 8, stone: 4 });
  });

  it('setShelf validates and is free', () => {
    const s = fresh();
    const r = ok(setShelf(s, 0, 'pearl', 1, 'berries', 6, { wood: 3 }));
    expect(r.stall.shelves[0]).toMatchObject({ give: 'pearl', n: 1, want: 'berries', m: 6 });
    expect(r.inv).toEqual({ wood: 3 });
    expect(s.shelves[0]!.give).toBe('wood'); // not mutated
    expect(setShelf(s, 0, 'wood', 1, 'wood', 1, {}).ok).toBe(false);
    expect(setShelf(s, 0, 'wood', 0, 'stone', 1, {}).ok).toBe(false);
    expect(setShelf(s, 0, 'wood', 21, 'stone', 1, {}).ok).toBe(false);
    expect(setShelf(s, 0, 'wood', 1, 'stone', 1.5, {}).ok).toBe(false);
    expect(setShelf(s, 4, 'wood', 1, 'stone', 1, {}).ok).toBe(false);
    expect(setShelf(s, 0, 'gold' as ItemId, 1, 'stone', 1, {}).ok).toBe(false);
  });

  it('a shelf with stock keeps its material; price changes are fine', () => {
    const s = ok(restock(fresh(), 0, { wood: 5 })).stall;
    const r = setShelf(s, 0, 'stone', 1, 'berries', 1, {});
    expect(r).toEqual({ ok: false, why: 'Quita el género primero.' });
    expect(ok(setShelf(s, 0, 'wood', 2, 'pearl', 3, {})).stall.shelves[0]).toMatchObject({ stock: 1, n: 2, want: 'pearl', m: 3 });
  });

  it('restock moves one tanda from the mochila, within the caps', () => {
    const s = ok(setShelf(fresh(), 0, 'wood', 20, 'berries', 1, {})).stall;
    const inv0: Inventory = { wood: 200 };
    const r = ok(restock(s, 0, inv0));
    expect(r.stall.shelves[0]!.stock).toBe(20);
    expect(r.inv).toEqual({ wood: 180 });
    expect(inv0).toEqual({ wood: 200 });
    expect(restock(s, 0, { wood: 19 })).toEqual({ ok: false, why: 'Te falta: madera.' });
    let t: Stall = s;
    let inv = inv0;
    for (let i = 0; i < 3; i++) ({ stall: t, inv } = ok(restock(t, 0, inv)));
    expect(t.shelves[0]!.stock).toBe(60);
    expect(restock(t, 0, inv).ok).toBe(false); // shelf cap
    t = ok(setShelf(t, 1, 'wood', 20, 'berries', 1, inv)).stall;
    for (let i = 0; i < 3; i++) ({ stall: t, inv } = ok(restock(t, 1, inv)));
    expect(stallGoods(t).wood).toBe(120);
    t = ok(setShelf(t, 2, 'wood', 1, 'berries', 1, inv)).stall;
    expect(restock(t, 2, inv).ok).toBe(false); // total cap
  });

  it('takeShelf returns the whole shelf; empty is refused', () => {
    const { stall, inv } = ok(restock(fresh(), 0, { wood: 4 }));
    const r = ok(takeShelf(stall, 0, inv));
    expect(r.inv).toEqual({ wood: 4 });
    expect(r.stall.shelves[0]!.stock).toBe(0);
    expect(takeShelf(r.stall, 0, r.inv).ok).toBe(false);
  });

  it('pickUp returns shelves, till and the cost', () => {
    let { stall, inv } = ok(restock(fresh(), 0, { wood: 3 }));
    stall = { ...stall, till: { berries: 7 } };
    expect(pickUp(stall, inv)).toEqual({ wood: 3 + 8, stone: 4, berries: 7 });
  });

  it('canPlaceStall: one per owner, 15 m apart', () => {
    const a = newStall(1, 'Ana', 0, 0, 0, 0);
    expect(canPlaceStall([a], 'Ana', 100, 100)).toBe('Ya tienes un puesto.');
    expect(canPlaceStall([a], 'Bea', 10, 0)).toBe('Hay otro puesto demasiado cerca.');
    expect(canPlaceStall([a], 'Bea', 16, 0)).toBeNull();
  });

  it('property: no sequence of set / restock / take creates or destroys materials', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    for (let run = 0; run < 500; run++) {
      let inv: Inventory = Object.fromEntries(ITEMS.map((k) => [k, Math.floor(rnd() * 40)]));
      let s = fresh();
      const start = total(inv, s);
      for (let step = 0; step < 40; step++) {
        const i = Math.floor(rnd() * 5) - (rnd() < 0.05 ? 1 : 0); // sometimes a bad index
        const op = rnd();
        const r = op < 0.3 ? setShelf(s, i, pick(ITEMS), Math.floor(rnd() * 23) - 1, pick(ITEMS), Math.floor(rnd() * 23) - 1, inv) : op < 0.75 ? restock(s, i, inv) : takeShelf(s, i, inv);
        if (r.ok) ({ stall: s, inv } = r);
        expect(total(inv, s)).toEqual(start);
        expect(Object.values(inv).every((v) => Number.isInteger(v) && v! >= 0)).toBe(true);
      }
      const back = pickUp(s, inv);
      for (const k of ITEMS) expect(back[k] ?? 0).toBe(start[k]! + (STALL.cost[k as 'wood' | 'stone'] ?? 0));
    }
  });

  it('buy: pay into the Caja, goods to the buyer, logged first', () => {
    let { stall } = ok(restock(ok(setShelf(fresh(), 0, 'pearl', 1, 'berries', 6, {})).stall, 0, { pearl: 1 }));
    stall = ok(restock(stall, 0, { pearl: 1 })).stall;
    const inv0: Inventory = { berries: 10 };
    const r = ok(buy(stall, 0, inv0, 'Bea', 14));
    expect(r.inv).toEqual({ berries: 4, pearl: 1 });
    expect(r.stall.shelves[0]!.stock).toBe(1);
    expect(r.stall.till).toEqual({ berries: 6 });
    expect(r.stall.log[0]).toEqual({ who: 'Bea', give: 'pearl', n: 1, want: 'berries', m: 6, day: 14 });
    expect(inv0).toEqual({ berries: 10 });
    expect(stall.shelves[0]!.stock).toBe(2);
    expect(buy(r.stall, 0, r.inv, 'Bea', 14)).toEqual({ ok: false, why: 'No te llega: bayas.' });
    expect(canBuy(r.stall, 0, r.inv)).toBe('No te llega: bayas.');
    expect(buy(fresh(), 0, { berries: 9 }, 'Bea', 1)).toEqual({ ok: false, why: 'No queda.' });
    expect(buy(stall, 7, { berries: 9 }, 'Bea', 1).ok).toBe(false);
    expect(canBuy(stall, 0, { berries: 6 })).toBeNull();
  });

  it('buy: the Caja never passes 200', () => {
    let s = ok(setShelf(fresh(), 0, 'wood', 1, 'stone', 20, {})).stall;
    s = ok(restock(s, 0, { wood: 1 })).stall;
    s = { ...s, till: { stone: 181 } };
    expect(tillTotal(s)).toBe(181);
    expect(buy(s, 0, { stone: 20 }, 'Bea', 1)).toEqual({ ok: false, why: 'Caja llena.' });
    s = { ...s, till: { stone: 180 } };
    expect(tillTotal(ok(buy(s, 0, { stone: 20 }, 'Bea', 1)).stall)).toBe(200);
  });

  it('the log keeps the last 10', () => {
    let s = ok(setShelf(fresh(), 0, 'wood', 1, 'stone', 1, {})).stall;
    let inv: Inventory = { wood: 20 };
    for (let i = 0; i < 2; i++) ({ stall: s, inv } = ok(restock(s, 0, inv)));
    s = ok(setShelf(s, 0, 'wood', 1, 'stone', 1, {})).stall;
    let b: Inventory = { stone: 20 };
    for (let k = 0; k < 2; k++) ({ stall: s, inv: b } = ok(buy(s, 0, b, `B${k}`, k)));
    for (let k = 0; k < 11; k++) {
      s = ok(restock(s, 0, { wood: 1 })).stall;
      ({ stall: s, inv: b } = ok(buy(s, 0, b.stone ? b : { stone: 5 }, `C${k}`, k)));
    }
    expect(s.log).toHaveLength(LOG_MAX);
    expect(s.log[0]!.who).toBe('C10');
  });

  it('collectTill empties the Caja into the mochila', () => {
    const s = { ...fresh(), till: { berries: 6, stone: 2 } };
    const r = ok(collectTill(s, { berries: 1 }));
    expect(r.inv).toEqual({ berries: 7, stone: 2 });
    expect(r.stall.till).toEqual({});
    expect(s.till).toEqual({ berries: 6, stone: 2 });
    expect(collectTill(r.stall, r.inv)).toEqual({ ok: false, why: 'La caja está vacía.' });
  });

  it('property: owner + two buyers — nothing created or destroyed, Caja ≤ 200, no overdraw', () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    for (let run = 0; run < 300; run++) {
      const invs: Inventory[] = [0, 1, 2].map(() => Object.fromEntries(ITEMS.map((k) => [k, Math.floor(rnd() * 60)])));
      let s = fresh();
      const sum = () => {
        const g = stallGoods(s);
        return Object.fromEntries(ITEMS.map((k) => [k, invs.reduce((a, v) => a + (v[k] ?? 0), 0) + (g[k] ?? 0)]));
      };
      const start = sum();
      for (let step = 0; step < 60; step++) {
        const i = Math.floor(rnd() * 5);
        const op = rnd();
        const who = op < 0.5 ? 0 : 1 + Math.floor(rnd() * 2);
        const r = op < 0.15 ? setShelf(s, i, pick(ITEMS), 1 + Math.floor(rnd() * 20), pick(ITEMS), 1 + Math.floor(rnd() * 20), invs[0]!) : op < 0.4 ? restock(s, i, invs[0]!) : op < 0.45 ? takeShelf(s, i, invs[0]!) : op < 0.5 ? collectTill(s, invs[0]!) : buy(s, i, invs[who]!, `P${who}`, step);
        if (r.ok) ({ stall: s, inv: invs[who]! } = r);
        expect(sum()).toEqual(start);
        expect(tillTotal(s)).toBeLessThanOrEqual(STALL.tillMax);
        for (const v of invs) expect(Object.values(v).every((x) => Number.isInteger(x) && x! >= 0)).toBe(true);
      }
    }
  });
});
