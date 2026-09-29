import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION } from '../protocol';
import { ITEMS, type Inventory, type ItemId } from '../items';
import { biomeItem, MERCHANT, stallGoods, type Stall } from '../shop';
import { HALF, waterLevel } from '../terrain';
import { DAY_LENGTH, inferFound, newWorld, WorldSim, type SavedPlayer } from './world-sim';

type Priv = { stalls: Stall[]; graves: { inv: Inventory }[]; structures: { id: number; kind: string; x: number; y: number; z: number; rot: number; owner: string; hp: number }[]; invasion2: string; wasNight: boolean; quartzVeins: { x: number; y: number; z: number }[] };
const priv = (s: WorldSim) => s as unknown as Priv;
const NAMES3 = ['Ana', 'Bea', 'Cai'];
const INV: Inventory = { wood: 40, stone: 40, pearl: 5, berries: 30, quartz: 6 };

function dry(sim: WorldSim): { x: number; z: number } {
  for (let x = 0; x < 200; x += 3) if (sim.terrain.heightAt(x, 5) > waterLevel(sim.terrain, x, 5) + 0.5 && sim.terrain.heightAt(x + 8, 5) > waterLevel(sim.terrain, x + 8, 5) + 0.5) return { x, z: 5 };
  throw new Error('no dry land');
}
function setup() {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of NAMES3) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  const at = dry(sim);
  NAMES3.forEach((n, i) => Object.assign(sim.getPlayer(n)!, { x: at.x + i, z: at.z, y: sim.terrain.heightAt(at.x + i, at.z), inv: { ...INV } }));
  priv(sim).structures.push({ id: 900, kind: 'heart', x: at.x, y: sim.terrain.heightAt(at.x, at.z), z: at.z, rot: 0, owner: 'Ana', hp: 500 });
  sim.drain();
  return { sim, at };
}
type Out = ReturnType<WorldSim['drain']>;
const toastsTo = (out: Out, who: string) => out.flatMap((o) => (o.to === who && o.msg.t === 'toast' ? [o.msg.text] : []));
function dawn(sim: WorldSim) {
  sim.time = Math.floor(sim.time / DAY_LENGTH) * DAY_LENGTH + DAY_LENGTH * 1.23;
  priv(sim).wasNight = true;
  sim.step(0.1);
}
function totals(sim: WorldSim): Record<string, number> {
  const all: Inventory[] = [...NAMES3.map((n) => sim.getPlayer(n)!.inv), ...priv(sim).graves.map((g) => g.inv), ...priv(sim).stalls.map(stallGoods)];
  return Object.fromEntries(ITEMS.map((k) => [k, all.reduce((a, i) => a + (i[k] ?? 0), 0)]));
}
const stallOf = (sim: WorldSim, who: string) => priv(sim).stalls.find((s) => s.owner === who)!;
function placeStall(sim: WorldSim, who: string, x: number, z: number) {
  const p = sim.getPlayer(who)!;
  Object.assign(p, { x, z, y: sim.terrain.heightAt(x, z) });
  sim.handle(who, { t: 'stallPlace', x: x + 2, z, rot: 0 });
  const s = stallOf(sim, who);
  if (!s) throw new Error(`no stall for ${who}: ${JSON.stringify(toastsTo(sim.drain(), who))}`);
  return s;
}
const self = (sim: WorldSim, who: string) => {
  const m = sim.snapshotFor(who);
  if (!m || m.t !== 'snap') throw new Error('snap');
  return m;
};

describe('Buhonero, biomas y encargos (T6-D, server)', () => {
  it('protocol 62; decoder', () => {
    expect(PROTOCOL_VERSION).toBe(66);
    expect(decodeClient('{"t":"deal","id":3}')).toEqual({ t: 'deal', id: 3 });
    for (const id of ['-1', '9', '1.5', '"a"']) expect(decodeClient(`{"t":"deal","id":${id}}`)).toBeNull();
    expect(decodeClient('{"t":"deliver","stall":4,"shelf":1}')).toEqual({ t: 'deliver', stall: 4, shelf: 1 });
    expect(decodeClient('{"t":"deliver","stall":4,"shelf":4}')).toBeNull();
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"stone","n":12,"want":"quartz","m":3,"mode":"want"}')).toEqual({ t: 'stallSet', shelf: 0, give: 'stone', n: 12, want: 'quartz', m: 3, mode: 'want' });
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"stone","n":12,"want":"quartz","m":3}')).toEqual({ t: 'stallSet', shelf: 0, give: 'stone', n: 12, want: 'quartz', m: 3 });
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"stone","n":12,"want":"quartz","m":3,"mode":"steal"}')).toBeNull();
  });

  it('no Buhonero before the rescue; the next dawn after it he is by the Corazón, and stays', () => {
    const { sim, at } = setup();
    dawn(sim);
    expect(self(sim, 'Ana').merchant).toBeNull();
    sim.handle('Ana', { t: 'deal', id: 0 });
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(40);
    priv(sim).invasion2 = 'rescued';
    dawn(sim);
    expect(self(sim, 'Ana').merchant).toEqual({ x: at.x + 6, z: at.z });
    const copy = new WorldSim(JSON.parse(JSON.stringify(sim.save())));
    copy.connect('Ana');
    expect(self(copy, 'Ana').merchant).toEqual({ x: at.x + 6, z: at.z });
  });

  it('tratos: in reach, one row each, 20 a day', () => {
    const { sim, at } = setup();
    priv(sim).invasion2 = 'rescued';
    dawn(sim);
    const p = sim.getPlayer('Ana')!;
    Object.assign(p, { x: at.x + 20, z: at.z });
    sim.drain();
    sim.handle('Ana', { t: 'deal', id: 0 });
    expect(toastsTo(sim.drain(), 'Ana')).toContain('Acércate al Buhonero.');
    Object.assign(p, { x: at.x + 5, z: at.z, inv: { wood: 500 } });
    sim.time += 1;
    sim.handle('Ana', { t: 'deal', id: 0 });
    expect(p.inv).toEqual({ wood: 495, berries: 1 });
    expect(self(sim, 'Ana').self.deals).toBe(19);
    for (let i = 0; i < 25; i++) {
      sim.time += 0.6;
      sim.handle('Ana', { t: 'deal', id: 0 });
    }
    expect(p.inv.berries).toBe(20);
    expect(self(sim, 'Ana').self.deals).toBe(0);
    sim.time += DAY_LENGTH;
    sim.handle('Ana', { t: 'deal', id: 0 });
    expect(p.inv.berries).toBe(21);
  });

  it('found: gathering counts, buying does not; old saves infer it', () => {
    const { sim } = setup();
    const v = priv(sim).quartzVeins[0]!;
    const p = sim.getPlayer('Bea')!;
    Object.assign(p, { x: v.x, y: v.y, z: v.z });
    expect(p.found ?? []).not.toContain('quartz');
    sim.handle('Bea', { t: 'quartz', id: 0 });
    expect(p.found).toContain('quartz');
    const old = { name: 'Leo', inv: { amber: 1 }, weaponLvl: 4 } as unknown as SavedPlayer;
    expect(inferFound(old)).toEqual(['pearl', 'amber', 'quartz']);
  });

  it('dawn restock: +1 of the local material, rare ones only if found', () => {
    const { sim, at } = setup();
    const s = placeStall(sim, 'Ana', at.x, at.z);
    expect(biomeItem(s.x, s.z)).toBe('berries');
    sim.handle('Ana', { t: 'stallSet', shelf: 0, give: 'berries', n: 1, want: 'wood', m: 1 });
    sim.handle('Ana', { t: 'stallSet', shelf: 1, give: 'quartz', n: 1, want: 'wood', m: 1 });
    dawn(sim);
    expect(stallOf(sim, 'Ana').shelves[0]!.stock).toBe(1);
    expect(stallOf(sim, 'Ana').shelves[1]!.stock).toBe(0);
    // a Puesto in the mountains selling quartz
    const m = stallOf(sim, 'Ana');
    Object.assign(m, { x: 0, z: -HALF - 30 });
    dawn(sim);
    expect(stallOf(sim, 'Ana').shelves[1]!.stock).toBe(0); // not found
    sim.getPlayer('Ana')!.found = ['quartz'];
    dawn(sim);
    expect(stallOf(sim, 'Ana').shelves[1]!.stock).toBe(1);
  });

  it('Encargo: pay set aside; Bea delivers while Ana is away and is paid at once', () => {
    const { sim, at } = setup();
    placeStall(sim, 'Ana', at.x, at.z);
    sim.handle('Ana', { t: 'stallSet', shelf: 0, give: 'stone', n: 12, want: 'quartz', m: 3, mode: 'want' });
    sim.handle('Ana', { t: 'stallStock', shelf: 0 });
    expect(sim.getPlayer('Ana')!.inv.stone).toBe(40 - 4 - 12);
    sim.markAway('Ana');
    const b = sim.getPlayer('Bea')!;
    Object.assign(b, { x: at.x + 2, z: at.z + 1 });
    const id = stallOf(sim, 'Ana').id;
    sim.time += 1;
    sim.handle('Bea', { t: 'deliver', stall: id, shelf: 0 });
    expect(b.inv.stone).toBe(52);
    expect(b.inv.quartz).toBe(3);
    expect(stallOf(sim, 'Ana').till).toEqual({ quartz: 3 });
    expect(sim.getPlayer('Ana')!.soldSince).toBe(1);
    sim.time += 1;
    sim.handle('Bea', { t: 'deliver', stall: id, shelf: 0 });
    expect(toastsTo(sim.drain(), 'Bea')).toContain('Ya no paga.');
  });

  it('property: totals = start + Buhonero rows + restocks', () => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    for (let run = 0; run < 30; run++) {
      const { sim, at } = setup();
      priv(sim).invasion2 = 'rescued';
      dawn(sim);
      placeStall(sim, 'Ana', at.x - 10, at.z);
      for (const n of NAMES3) Object.assign(sim.getPlayer(n)!, { x: at.x - 8 + rnd() * 4, z: at.z, found: ['quartz'] });
      const ledger: Record<string, number> = Object.fromEntries(ITEMS.map((k) => [k, 0]));
      const start = totals(sim);
      for (let step = 0; step < 100; step++) {
        const who = pick(NAMES3);
        const p = sim.getPlayer(who)!;
        const id = stallOf(sim, 'Ana').id;
        const sh = Math.floor(rnd() * 4);
        const op = rnd();
        const before = { ...p.inv };
        sim.time += 0.6;
        if (op < 0.2) {
          const d = Math.floor(rnd() * MERCHANT.deals.length);
          sim.handle(who, { t: 'deal', id: d });
          const row = MERCHANT.deals[d]!;
          const moved = (p.inv[row.give] ?? 0) !== (before[row.give] ?? 0);
          if (moved) {
            ledger[row.give] = ledger[row.give]! - row.n;
            ledger[row.get] = ledger[row.get]! + row.m;
          }
        } else if (op < 0.35) sim.handle(who, { t: 'deliver', stall: id, shelf: sh });
        else if (op < 0.45) sim.handle(who, { t: 'buy', stall: id, shelf: sh });
        else if (op < 0.6) sim.handle(who, { t: 'stallSet', shelf: sh, give: pick(ITEMS), n: 1 + Math.floor(rnd() * 5), want: pick(ITEMS), m: 1 + Math.floor(rnd() * 5), ...(rnd() < 0.6 ? { mode: pick(['sell', 'want'] as const) } : {}) });
        else if (op < 0.75) sim.handle(who, { t: 'stallStock', shelf: sh });
        else if (op < 0.8) sim.handle(who, { t: 'stallTake', shelf: sh });
        else if (op < 0.85) sim.handle(who, { t: 'stallTill' });
        else if (op < 0.9) Object.assign(p, { x: at.x - 10 + (rnd() - 0.5) * 30, z: at.z });
        else if (op < 0.93) sim.markAway(who);
        else if (op < 0.96) sim.connect(who);
        else {
          const s = stallOf(sim, 'Ana');
          if (rnd() < 0.5) Object.assign(s, { x: pick([at.x - 10, 0]), z: pick([at.z, -HALF - 30]) });
          const k = biomeItem(s.x, s.z) as ItemId;
          const was = stallOf(sim, 'Ana').shelves.reduce((a, x) => a + (x.mode === 'sell' && x.give === k ? x.stock : 0), 0);
          dawn(sim);
          const now = stallOf(sim, 'Ana').shelves.reduce((a, x) => a + (x.mode === 'sell' && x.give === k ? x.stock : 0), 0);
          ledger[k] = ledger[k]! + (now - was);
          expect(now - was).toBeGreaterThanOrEqual(0);
          expect(now - was).toBeLessThanOrEqual(1);
        }
        const t = totals(sim);
        for (const k of ITEMS) expect(t[k]).toBe(start[k]! + ledger[k]!);
        for (const n of NAMES3) expect(Object.values(sim.getPlayer(n)!.inv).every((v) => Number.isInteger(v) && v! >= 0)).toBe(true);
        expect(stallOf(sim, 'Ana').shelves.filter((x) => x.mode === 'want').length).toBeLessThanOrEqual(2);
      }
    }
  });
});
