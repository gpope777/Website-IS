import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION, type ServerMsg } from '../protocol';
import { ITEMS, type Inventory } from '../items';
import { STALL, stallGoods, tillTotal, type Stall } from '../shop';
import { waterLevel } from '../terrain';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';

type Priv = { stalls: Stall[]; graves: { inv: Inventory }[] };
const priv = (s: WorldSim) => s as unknown as Priv;
const NAMES3 = ['Ana', 'Bea', 'Cai'];

function dry(sim: WorldSim): { x: number; z: number } {
  for (let x = 0; x < 200; x += 3) if (sim.terrain.heightAt(x, 5) > waterLevel(sim.terrain, x, 5) + 0.5) return { x, z: 5 };
  throw new Error('no dry land');
}
/** Ana owns a Puesto selling 1 perla por 6 bayas (stock 3); Bea and Cai stand beside it. */
function setup(mod?: (w: SavedWorld) => void) {
  const w = newWorld(42, 'salt');
  mod?.(w);
  const sim = new WorldSim(w);
  for (const n of NAMES3) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  const at = dry(sim);
  for (const n of NAMES3) Object.assign(sim.getPlayer(n)!, { x: at.x, z: at.z + 2, y: sim.terrain.heightAt(at.x, at.z + 2), inv: { wood: 30, stone: 10, pearl: 5, berries: 12 } });
  sim.handle('Ana', { t: 'stallPlace', x: at.x, z: at.z, rot: 0 });
  sim.handle('Ana', { t: 'stallSet', shelf: 0, give: 'pearl', n: 1, want: 'berries', m: 6 });
  for (let i = 0; i < 3; i++) sim.handle('Ana', { t: 'stallStock', shelf: 0 });
  sim.drain();
  const id = priv(sim).stalls[0]!.id;
  return { sim, at, id };
}
const sent = (sim: WorldSim) => sim.drain();
const toastsTo = (out: ReturnType<WorldSim['drain']>, who: string) => out.flatMap((o) => (o.to === who && o.msg.t === 'toast' ? [o.msg.text] : []));
const wait = (sim: WorldSim) => (sim.time += 0.6);
function totals(sim: WorldSim): Record<string, number> {
  const all: Inventory[] = [...NAMES3.map((n) => sim.getPlayer(n)!.inv), ...priv(sim).graves.map((g) => g.inv), ...priv(sim).stalls.map(stallGoods)];
  return Object.fromEntries(ITEMS.map((k) => [k, all.reduce((a, i) => a + (i[k] ?? 0), 0)]));
}

describe('comprar y Caja (T6-B, server)', () => {
  it('protocol 60; decodeClient checks buy and stallTill', () => {
    expect(PROTOCOL_VERSION).toBe(62);
    expect(decodeClient('{"t":"buy","stall":3,"shelf":1}')).toEqual({ t: 'buy', stall: 3, shelf: 1 });
    expect(decodeClient('{"t":"buy","stall":-1,"shelf":1}')).toBeNull();
    expect(decodeClient('{"t":"buy","stall":3,"shelf":4}')).toBeNull();
    expect(decodeClient('{"t":"buy","stall":"3","shelf":0}')).toBeNull();
    expect(decodeClient('{"t":"stallTill"}')).toEqual({ t: 'stallTill' });
  });

  it('Bea buys: goods, Caja, log, event and toasts', () => {
    const { sim, id } = setup();
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    const out = sent(sim);
    expect(sim.getPlayer('Bea')!.inv).toMatchObject({ pearl: 6, berries: 6 });
    const s = priv(sim).stalls[0]!;
    expect(s.shelves[0]!.stock).toBe(2);
    expect(s.till).toEqual({ berries: 6 });
    expect(s.log[0]).toMatchObject({ who: 'Bea', give: 'pearl', n: 1, want: 'berries', m: 6, day: 1 });
    expect(out.some((o) => o.to === null && o.msg.t === 'stall')).toBe(true);
    expect(toastsTo(out, 'Bea')).toContain('Compras 1 perlas.');
    expect(toastsTo(out, 'Ana')).toContain('Bea compró 1 perlas en tu puesto.');
  });

  it('refusals change nothing: far, own, unknown, short', () => {
    const { sim, id } = setup();
    const before = JSON.stringify([totals(sim), priv(sim).stalls, NAMES3.map((n) => sim.getPlayer(n)!.inv)]);
    sim.handle('Ana', { t: 'buy', stall: id, shelf: 0 });
    expect(toastsTo(sent(sim), 'Ana')).toContain('Es tu puesto.');
    wait(sim);
    sim.handle('Bea', { t: 'buy', stall: id + 99, shelf: 0 });
    wait(sim);
    const c = sim.getPlayer('Cai')!;
    c.x += 10;
    sim.handle('Cai', { t: 'buy', stall: id, shelf: 0 });
    expect(toastsTo(sent(sim), 'Cai')).toContain('Acércate al puesto.');
    c.x -= 10;
    c.inv = { berries: 5 };
    wait(sim);
    sim.handle('Cai', { t: 'buy', stall: id, shelf: 0 });
    expect(toastsTo(sent(sim), 'Cai')).toContain('No te llega: bayas.');
    c.inv = { wood: 30, stone: 10, pearl: 5, berries: 12 };
    wait(sim);
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 1 });
    expect(toastsTo(sent(sim), 'Bea')).toContain('No queda.');
    expect(JSON.stringify([totals(sim), priv(sim).stalls, NAMES3.map((n) => sim.getPlayer(n)!.inv)])).toBe(before);
  });

  it('one purchase every 0,5 s per player', () => {
    const { sim, id } = setup();
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    sim.handle('Cai', { t: 'buy', stall: id, shelf: 0 });
    expect(priv(sim).stalls[0]!.shelves[0]!.stock).toBe(1);
    wait(sim);
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    expect(priv(sim).stalls[0]!.shelves[0]!.stock).toBe(0);
  });

  it('sales while the owner is away are counted and told on connect', () => {
    const { sim, id } = setup();
    sim.markAway('Ana');
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    wait(sim);
    sim.handle('Cai', { t: 'buy', stall: id, shelf: 0 });
    expect(toastsTo(sent(sim), 'Ana')).toEqual([]);
    expect(sim.getPlayer('Ana')!.soldSince).toBe(2);
    const again = new WorldSim(JSON.parse(JSON.stringify(sim.save())) as SavedWorld);
    expect(again.getPlayer('Ana')!.soldSince).toBe(2);
    sim.connect('Ana');
    expect(toastsTo(sent(sim), 'Ana')).toContain('Tu puesto vendió 2 veces desde que te fuiste.');
    expect(sim.getPlayer('Ana')!.soldSince).toBeUndefined();
    sim.connect('Ana');
    expect(toastsTo(sent(sim), 'Ana')).toEqual([]);
  });

  it('Vaciar caja: only the owner, beside it', () => {
    const { sim, id } = setup();
    sim.handle('Bea', { t: 'buy', stall: id, shelf: 0 });
    sim.handle('Bea', { t: 'stallTill' });
    expect(tillTotal(priv(sim).stalls[0]!)).toBe(6);
    sim.handle('Ana', { t: 'stallTill' });
    expect(tillTotal(priv(sim).stalls[0]!)).toBe(0);
    expect(sim.getPlayer('Ana')!.inv.berries).toBe(18);
    sent(sim);
    sim.handle('Ana', { t: 'stallTill' });
    expect(toastsTo(sent(sim), 'Ana')).toContain('La caja está vacía.');
  });

  it('property: three players buying, stocking and emptying conserve materials; Caja ≤ 200', () => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const item = () => ITEMS[Math.floor(rnd() * ITEMS.length)]!;
    for (let run = 0; run < 30; run++) {
      const { sim, id } = setup();
      for (const n of NAMES3) sim.getPlayer(n)!.inv = Object.fromEntries(ITEMS.map((k) => [k, Math.floor(rnd() * 80)]));
      const start = totals(sim);
      for (let step = 0; step < 80; step++) {
        const who = NAMES3[Math.floor(rnd() * 3)]!;
        const shelf = Math.floor(rnd() * STALL.shelves);
        const op = Math.floor(rnd() * 6);
        if (op <= 1) sim.handle(who, { t: 'buy', stall: rnd() < 0.9 ? id : id + 1, shelf });
        else if (op === 2) sim.handle(who, { t: 'stallTill' });
        else if (op === 3) sim.handle(who, { t: 'stallStock', shelf });
        else if (op === 4) sim.handle(who, { t: 'stallSet', shelf, give: item(), n: 1 + Math.floor(rnd() * 20), want: item(), m: 1 + Math.floor(rnd() * 20) });
        else sim.handle(who, { t: 'stallTake', shelf });
        if (rnd() < 0.5) sim.time += rnd();
        sim.drain();
        expect(totals(sim)).toEqual(start);
        expect(tillTotal(priv(sim).stalls[0]!)).toBeLessThanOrEqual(STALL.tillMax);
        for (const n of NAMES3) expect(Object.values(sim.getPlayer(n)!.inv).every((v) => Number.isInteger(v) && v! >= 0)).toBe(true);
      }
    }
  });
});
