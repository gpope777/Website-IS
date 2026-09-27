import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION, type ServerMsg } from '../protocol';
import { ITEMS, type Inventory } from '../items';
import { STALL, stallGoods, type Stall } from '../shop';
import { waterLevel } from '../terrain';
import { DAY_LENGTH, newWorld, WorldSim, type SavedWorld } from './world-sim';

type Priv = { stalls: Stall[]; graves: { inv: Inventory }[]; structures: unknown[] };
const priv = (s: WorldSim) => s as unknown as Priv;

/** A dry spot near the origin (the forest spawn). */
function dry(sim: WorldSim, from = 0): { x: number; z: number } {
  for (let x = from; x < from + 200; x += 3) if (sim.terrain.heightAt(x, 5) > waterLevel(sim.terrain, x, 5) + 0.5) return { x, z: 5 };
  throw new Error('no dry land');
}
function setup(mod?: (w: SavedWorld) => void) {
  const w = newWorld(42, 'salt');
  mod?.(w);
  const sim = new WorldSim(w);
  for (const n of ['Ana', 'Bea']) {
    if (!sim.getPlayer(n)) sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  const at = dry(sim);
  for (const n of ['Ana', 'Bea']) {
    const p = sim.getPlayer(n)!;
    Object.assign(p, { x: at.x, z: at.z + 2, y: sim.terrain.heightAt(at.x, at.z + 2), inv: { wood: 30, stone: 10, pearl: 5, berries: 12 } });
  }
  sim.drain();
  return { sim, at };
}
const sent = (sim: WorldSim) => sim.drain().map((o) => o.msg as ServerMsg);
const toasts = (sim: WorldSim) => sent(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
function place(sim: WorldSim, at = dry(sim)) {
  sim.handle('Ana', { t: 'stallPlace', x: at.x, z: at.z, rot: 0 });
}
function totals(sim: WorldSim): Record<string, number> {
  const all: Inventory[] = [...['Ana', 'Bea'].map((n) => sim.getPlayer(n)!.inv), ...priv(sim).graves.map((g) => g.inv), ...priv(sim).stalls.map(stallGoods)];
  return Object.fromEntries(ITEMS.map((k) => [k, all.reduce((a, i) => a + (i[k] ?? 0), 0)]));
}

describe('el Puesto (T6-A, server)', () => {
  it('protocol 59; decodeClient checks the stall messages', () => {
    expect(PROTOCOL_VERSION).toBe(62);
    expect(decodeClient('{"t":"stallPlace","x":1,"z":2,"rot":0}')).toEqual({ t: 'stallPlace', x: 1, z: 2, rot: 0 });
    expect(decodeClient('{"t":"stallSet","shelf":3,"give":"pearl","n":1,"want":"berries","m":6}')).toEqual({ t: 'stallSet', shelf: 3, give: 'pearl', n: 1, want: 'berries', m: 6 });
    expect(decodeClient('{"t":"stallSet","shelf":4,"give":"pearl","n":1,"want":"berries","m":6}')).toBeNull();
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"gold","n":1,"want":"berries","m":6}')).toBeNull();
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"pearl","n":21,"want":"berries","m":6}')).toBeNull();
    expect(decodeClient('{"t":"stallSet","shelf":0,"give":"pearl","n":1,"want":"berries","m":0}')).toBeNull();
    expect(decodeClient('{"t":"stallStock","shelf":1.5}')).toBeNull();
    expect(decodeClient('{"t":"stallTake","shelf":2}')).toEqual({ t: 'stallTake', shelf: 2 });
    expect(decodeClient('{"t":"stallPick"}')).toEqual({ t: 'stallPick' });
  });

  it('building costs 8 wood 4 stone, tells everyone and shows in welcome', () => {
    const { sim } = setup();
    place(sim);
    const out = sim.drain();
    expect(sim.getPlayer('Ana')!.inv).toMatchObject({ wood: 22, stone: 6 });
    const ev = out.find((o) => o.msg.t === 'stall')!;
    expect(ev.to).toBeNull();
    expect((ev.msg as Extract<ServerMsg, { t: 'stall' }>).s.owner).toBe('Ana');
    expect(priv(sim).structures).toHaveLength(0); // never a siege target
  });

  it('refuses a second one, one too close, too far, off-map; nothing spent', () => {
    const { sim, at } = setup();
    place(sim, at);
    sim.drain();
    const inv = { ...sim.getPlayer('Ana')!.inv };
    place(sim, { x: at.x, z: at.z + 1 });
    expect(toasts(sim)).toContain('Ya tienes un puesto.');
    sim.handle('Bea', { t: 'stallPlace', x: at.x + 3, z: at.z, rot: 0 });
    expect(toasts(sim)).toContain('Hay otro puesto demasiado cerca.');
    sim.handle('Bea', { t: 'stallPlace', x: at.x + 40, z: at.z, rot: 0 });
    expect(toasts(sim)).toContain('Demasiado lejos');
    const b = sim.getPlayer('Bea')!;
    Object.assign(b, { x: 99999, z: 99999 });
    sim.handle('Bea', { t: 'stallPlace', x: 99999, z: 99999, rot: 0 });
    expect(toasts(sim)).toContain('No se puede poner aquí');
    expect(sim.getPlayer('Ana')!.inv).toEqual(inv);
    expect(b.inv).toMatchObject({ wood: 30, stone: 10 });
    expect(priv(sim).stalls).toHaveLength(1);
  });

  it('without materials: refused', () => {
    const { sim } = setup();
    sim.getPlayer('Ana')!.inv = { wood: 7, stone: 4 };
    place(sim);
    expect(toasts(sim)).toContain('Faltan materiales');
    expect(priv(sim).stalls).toHaveLength(0);
  });

  it('only the owner, beside it, sets, stocks, takes and picks up', () => {
    const { sim } = setup();
    place(sim);
    sim.handle('Ana', { t: 'stallSet', shelf: 0, give: 'pearl', n: 1, want: 'berries', m: 6 });
    sim.handle('Ana', { t: 'stallStock', shelf: 0 });
    sim.handle('Ana', { t: 'stallStock', shelf: 0 });
    const s = priv(sim).stalls[0]!;
    expect(s.shelves[0]).toMatchObject({ give: 'pearl', want: 'berries', m: 6, stock: 2 });
    expect(sim.getPlayer('Ana')!.inv.pearl).toBe(3);
    sim.drain();
    sim.handle('Bea', { t: 'stallTake', shelf: 0 });
    sim.handle('Bea', { t: 'stallSet', shelf: 0, give: 'wood', n: 1, want: 'stone', m: 1 });
    sim.handle('Bea', { t: 'stallPick' });
    expect(priv(sim).stalls[0]!.shelves[0]!.stock).toBe(2);
    expect(sent(sim).some((m) => m.t === 'stall')).toBe(false);
    const a = sim.getPlayer('Ana')!;
    a.x += 10;
    sim.handle('Ana', { t: 'stallTake', shelf: 0 });
    expect(toasts(sim)).toContain('Acércate a tu puesto.');
    a.x -= 10;
    sim.handle('Ana', { t: 'stallTake', shelf: 0 });
    expect(a.inv.pearl).toBe(5);
    sim.handle('Ana', { t: 'stallStock', shelf: 0 });
    sim.drain();
    sim.handle('Ana', { t: 'stallPick' });
    const out = sent(sim);
    expect(out.some((m) => m.t === 'stall' && m.gone)).toBe(true);
    expect(priv(sim).stalls).toHaveLength(0);
    expect(a.inv).toEqual({ wood: 30, stone: 10, pearl: 5, berries: 12 });
  });

  it('save → load keeps it; an old save has none', () => {
    const { sim } = setup();
    place(sim);
    sim.handle('Ana', { t: 'stallStock', shelf: 0 });
    const saved = sim.save();
    expect(saved.stalls).toHaveLength(1);
    const again = new WorldSim(JSON.parse(JSON.stringify(saved)) as SavedWorld);
    expect(priv(again).stalls[0]!.shelves[0]!.stock).toBe(1);
    const old = newWorld(42, 'salt');
    expect(old.stalls).toBeUndefined();
    expect(priv(new WorldSim(old)).stalls).toEqual([]);
    expect(new WorldSim(old).save().stalls).toBeUndefined();
  });

  it('welcome carries the Puestos', () => {
    const { sim } = setup();
    place(sim);
    sim.createPlayer('Cai', 'hash');
    const w = sim.connect('Cai') as Extract<ServerMsg, { t: 'welcome' }>;
    expect(w.stalls).toHaveLength(1);
  });

  it('property: random stall messages from owner and stranger conserve materials', () => {
    let seed = 3;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 40; run++) {
      const { sim, at } = setup();
      for (let step = 0; step < 60; step++) {
        const before = totals(sim);
        const had = priv(sim).stalls.length;
        const who = rnd() < 0.7 ? 'Ana' : 'Bea';
        const shelf = Math.floor(rnd() * STALL.shelves);
        const op = Math.floor(rnd() * 5);
        const item = () => ITEMS[Math.floor(rnd() * ITEMS.length)]!;
        if (op === 0) sim.handle(who, { t: 'stallPlace', x: at.x + (who === 'Bea' ? 20 : 0), z: at.z, rot: 0 });
        else if (op === 1) sim.handle(who, { t: 'stallSet', shelf, give: item(), n: 1 + Math.floor(rnd() * 20), want: item(), m: 1 + Math.floor(rnd() * 20) });
        else if (op === 2) sim.handle(who, { t: 'stallStock', shelf });
        else if (op === 3) sim.handle(who, { t: 'stallTake', shelf });
        else if (rnd() < 0.3) sim.handle(who, { t: 'stallPick' });
        sim.drain();
        const after = totals(sim);
        const d = priv(sim).stalls.length - had; // +1 built (cost gone), −1 picked up (cost back)
        expect(after.wood).toBe(before.wood! - d * 8);
        expect(after.stone).toBe(before.stone! - d * 4);
        for (const k of ITEMS) if (k !== 'wood' && k !== 'stone') expect(after[k]).toBe(before[k]);
      }
    }
  });
});
