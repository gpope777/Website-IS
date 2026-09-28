import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION, type TradeView } from '../protocol';
import { ITEMS, type Inventory } from '../items';
import { offerInv, stallGoods, TRADE, type Stall, type TradeLine } from '../shop';
import { inAnyDungeon } from '../dungeon';
import { waterLevel } from '../terrain';
import { DAY_LENGTH, newWorld, WorldSim, type SavedPlayer } from './world-sim';

type Tr = { a: string; b: string; open: boolean; la: TradeLine[]; lb: TradeLine[]; okA: boolean; okB: boolean };
type Priv = { stalls: Stall[]; graves: { inv: Inventory }[]; trades: Tr[]; kill(p: SavedPlayer): void };
const priv = (s: WorldSim) => s as unknown as Priv;
const NAMES3 = ['Ana', 'Bea', 'Cai'];
const INV: Inventory = { wood: 30, stone: 10, pearl: 5, berries: 12 };

function dry(sim: WorldSim): { x: number; z: number } {
  for (let x = 0; x < 200; x += 3) if (sim.terrain.heightAt(x, 5) > waterLevel(sim.terrain, x, 5) + 0.5 && sim.terrain.heightAt(x + 8, 5) > waterLevel(sim.terrain, x + 8, 5) + 0.5) return { x, z: 5 };
  throw new Error('no dry land');
}
/** Ana, Bea and Cai stand 1 m apart in a row on dry land, daytime. */
function setup() {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of NAMES3) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  const at = dry(sim);
  NAMES3.forEach((n, i) => Object.assign(sim.getPlayer(n)!, { x: at.x + i, z: at.z, y: sim.terrain.heightAt(at.x + i, at.z), inv: { ...INV } }));
  sim.drain();
  return { sim, at };
}
type Out = ReturnType<WorldSim['drain']>;
const toastsTo = (out: Out, who: string) => out.flatMap((o) => (o.to === who && o.msg.t === 'toast' ? [o.msg.text] : []));
const viewOf = (out: Out, who: string): TradeView | null | undefined => {
  let v: TradeView | null | undefined;
  for (const o of out) if (o.to === who && o.msg.t === 'trade') v = o.msg.tr;
  return v;
};
function totals(sim: WorldSim): Record<string, number> {
  const all: Inventory[] = [...NAMES3.map((n) => sim.getPlayer(n)!.inv), ...priv(sim).graves.map((g) => g.inv), ...priv(sim).stalls.map(stallGoods)];
  return Object.fromEntries(ITEMS.map((k) => [k, all.reduce((a, i) => a + (i[k] ?? 0), 0)]));
}
/** Ana asks, Bea says Ver: an open trade. */
function open(sim: WorldSim) {
  sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
  sim.handle('Bea', { t: 'tradeAnswer', yes: true });
  return sim.drain();
}

describe('trueque directo (T6-C, server)', () => {
  it('protocol 61; decodeClient checks the five trade messages', () => {
    expect(PROTOCOL_VERSION).toBe(65);
    expect(decodeClient('{"t":"tradeAsk","to":"Bea"}')).toEqual({ t: 'tradeAsk', to: 'Bea' });
    expect(decodeClient('{"t":"tradeAsk","to":""}')).toBeNull();
    expect(decodeClient('{"t":"tradeAsk","to":3}')).toBeNull();
    expect(decodeClient('{"t":"tradeAnswer","yes":false}')).toEqual({ t: 'tradeAnswer', yes: false });
    expect(decodeClient('{"t":"tradeAnswer","yes":"no"}')).toBeNull();
    expect(decodeClient('{"t":"tradeOffer","lines":[{"item":"pearl","n":2,"x":1}]}')).toEqual({ t: 'tradeOffer', lines: [{ item: 'pearl', n: 2 }] });
    expect(decodeClient('{"t":"tradeOffer","lines":[]}')).toEqual({ t: 'tradeOffer', lines: [] });
    for (const bad of ['[{"item":"pearl","n":1},{"item":"wood","n":1},{"item":"amber","n":1},{"item":"stone","n":1}]', '[{"item":"pearl","n":1},{"item":"pearl","n":1}]', '[{"item":"rank","n":1}]', '[{"item":"hat","n":1}]', '[{"item":"pearl","n":0}]', '[{"item":"pearl","n":100}]', '[{"item":"pearl","n":1.5}]', '"pearl"'])
      expect(decodeClient(`{"t":"tradeOffer","lines":${bad}}`)).toBeNull();
    expect(decodeClient('{"t":"tradeOk"}')).toEqual({ t: 'tradeOk' });
    expect(decodeClient('{"t":"tradeCancel"}')).toEqual({ t: 'tradeCancel' });
  });

  it('asking: views to both; refusals for far, self, unknown, busy', () => {
    const { sim } = setup();
    sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
    const out = sim.drain();
    expect(viewOf(out, 'Ana')).toMatchObject({ with: 'Bea', asker: true, open: false });
    expect(viewOf(out, 'Bea')).toMatchObject({ with: 'Ana', asker: false, open: false });
    expect(toastsTo(out, 'Bea')).toContain('Ana quiere cambiar.');
    sim.time += 6;
    sim.handle('Cai', { t: 'tradeAsk', to: 'Bea' });
    expect(toastsTo(sim.drain(), 'Cai')).toContain('Bea ya está cambiando.');
    sim.time += 6;
    sim.handle('Cai', { t: 'tradeAsk', to: 'Cai' });
    sim.handle('Cai', { t: 'tradeAsk', to: 'Zoe' });
    expect(priv(sim).trades).toHaveLength(1);
    const c = sim.getPlayer('Cai')!;
    sim.handle('Ana', { t: 'tradeCancel' });
    sim.drain();
    sim.time += 6;
    c.x = sim.getPlayer('Bea')!.x + 5;
    sim.handle('Cai', { t: 'tradeAsk', to: 'Bea' });
    expect(toastsTo(sim.drain(), 'Cai')).toContain('Acércate a Bea.');
    expect(priv(sim).trades).toHaveLength(0);
  });

  it('one ask every 5 s; three No in a row → 60 s before asking them again', () => {
    const { sim } = setup();
    sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
    sim.handle('Bea', { t: 'tradeAnswer', yes: false });
    const out = sim.drain();
    expect(toastsTo(out, 'Ana')).toContain('Bea dice que no.');
    expect(viewOf(out, 'Ana')).toBeNull();
    sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
    expect(priv(sim).trades).toHaveLength(0); // too soon: ignored
    for (let i = 0; i < 2; i++) {
      sim.time += TRADE.askEvery;
      sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
      sim.handle('Bea', { t: 'tradeAnswer', yes: false });
    }
    sim.drain();
    sim.time += TRADE.askEvery;
    sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
    expect(toastsTo(sim.drain(), 'Ana')).toContain('Bea no quiere cambiar ahora.');
    sim.time += TRADE.askEvery;
    sim.handle('Ana', { t: 'tradeAsk', to: 'Cai' });
    expect(priv(sim).trades).toHaveLength(1);
    sim.handle('Ana', { t: 'tradeCancel' });
    sim.time += TRADE.noWait;
    sim.handle('Ana', { t: 'tradeAsk', to: 'Bea' });
    expect(priv(sim).trades[0]).toMatchObject({ a: 'Ana', b: 'Bea' });
  });

  it('offers clear both Vale; both Vale swap the mochilas and ask for a save', () => {
    const { sim } = setup();
    open(sim);
    sim.handle('Ana', { t: 'tradeOffer', lines: [{ item: 'pearl', n: 2 }] });
    sim.handle('Ana', { t: 'tradeOk' });
    sim.handle('Bea', { t: 'tradeOffer', lines: [{ item: 'wood', n: 10 }, { item: 'berries', n: 3 }] });
    let out = sim.drain();
    expect(viewOf(out, 'Ana')).toMatchObject({ mine: [{ item: 'pearl', n: 2 }], theirs: [{ item: 'wood', n: 10 }, { item: 'berries', n: 3 }], okMine: false, okTheirs: false, open: true });
    sim.handle('Bea', { t: 'tradeOffer', lines: [{ item: 'pearl', n: 6 }] });
    expect(toastsTo(sim.drain(), 'Bea')).toContain('No tienes tanto.');
    expect(sim.takeSave()).toBe(false);
    sim.handle('Ana', { t: 'tradeOk' });
    expect(viewOf(sim.drain(), 'Bea')).toMatchObject({ okTheirs: true, okMine: false });
    sim.handle('Bea', { t: 'tradeOk' });
    out = sim.drain();
    expect(sim.getPlayer('Ana')!.inv).toMatchObject({ pearl: 3, wood: 40, berries: 15 });
    expect(sim.getPlayer('Bea')!.inv).toMatchObject({ pearl: 7, wood: 20, berries: 9 });
    expect(viewOf(out, 'Ana')).toBeNull();
    expect(viewOf(out, 'Bea')).toBeNull();
    expect(toastsTo(out, 'Ana')).toContain('Hecho.');
    expect(priv(sim).trades).toHaveLength(0);
    expect(sim.takeSave()).toBe(true);
    expect(sim.takeSave()).toBe(false);
  });

  it('a gift is one side only; a mochila that shrank since cancels without moving anything', () => {
    const { sim } = setup();
    open(sim);
    sim.handle('Ana', { t: 'tradeOffer', lines: [{ item: 'stone', n: 4 }] });
    sim.handle('Ana', { t: 'tradeOk' });
    sim.handle('Bea', { t: 'tradeOk' });
    expect(sim.getPlayer('Bea')!.inv.stone).toBe(14);
    sim.drain();
    sim.time += TRADE.askEvery;
    open(sim);
    sim.handle('Ana', { t: 'tradeOffer', lines: [{ item: 'pearl', n: 5 }] });
    sim.handle('Ana', { t: 'tradeOk' });
    sim.getPlayer('Ana')!.inv.pearl = 4; // spent meanwhile
    const before = totals(sim);
    const bea = { ...sim.getPlayer('Bea')!.inv };
    sim.handle('Bea', { t: 'tradeOk' });
    const out = sim.drain();
    expect(toastsTo(out, 'Bea')).toContain('A Ana no le llega: perlas.');
    expect(viewOf(out, 'Bea')).toBeNull();
    expect(sim.getPlayer('Bea')!.inv).toEqual(bea);
    expect(totals(sim)).toEqual(before);
  });

  it('cancels: too far, death, away, dungeon, 60 s, cancel', () => {
    const cases: [string, (sim: WorldSim) => void][] = [
      ['far', (sim) => (sim.getPlayer('Bea')!.x += TRADE.leash + 1)],
      ['die', (sim) => priv(sim).kill(sim.getPlayer('Bea')!)],
      ['away', (sim) => sim.markAway('Bea')],
      ['time', (sim) => (sim.time += TRADE.timeout)],
      ['cancel', (sim) => sim.handle('Bea', { t: 'tradeCancel' })],
    ];
    for (const [, act] of cases) {
      const { sim } = setup();
      open(sim);
      sim.handle('Ana', { t: 'tradeOffer', lines: [{ item: 'pearl', n: 1 }] });
      sim.handle('Ana', { t: 'tradeOk' });
      sim.drain();
      const inv = NAMES3.map((n) => ({ ...sim.getPlayer(n)!.inv }));
      act(sim);
      sim.step(0.1);
      const out = sim.drain();
      expect(priv(sim).trades).toHaveLength(0);
      expect(viewOf(out, 'Ana')).toBeNull();
      expect(toastsTo(out, 'Ana').some((t) => t.startsWith('Cambio cancelado'))).toBe(true);
      sim.handle('Bea', { t: 'tradeOk' });
      expect(NAMES3.map((n) => sim.getPlayer(n)!.inv)).toEqual(inv);
    }
    const { sim } = setup();
    open(sim);
    let d: { x: number; z: number } | null = null;
    for (let x = -600; x < 600 && !d; x += 4) for (let z = -600; z < 600 && !d; z += 4) if (inAnyDungeon(x, z)) d = { x, z };
    Object.assign(sim.getPlayer('Ana')!, d);
    Object.assign(sim.getPlayer('Bea')!, { x: d!.x, z: d!.z });
    sim.step(0.1);
    expect(priv(sim).trades).toHaveLength(0);
  });

  it('property: 3 players asking, offering, confirming, cancelling, moving, leaving: nothing appears, vanishes or half-moves', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
    const lines = (): TradeLine[] => [...ITEMS].sort(() => rnd() - 0.5).slice(0, Math.floor(rnd() * 4)).map((item) => ({ item, n: 1 + Math.floor(rnd() * 8) }));
    for (let run = 0; run < 40; run++) {
      const { sim } = setup();
      const players = run % 2 ? NAMES3 : NAMES3.slice(0, 2);
      for (const n of NAMES3) sim.getPlayer(n)!.inv = Object.fromEntries(ITEMS.map((k) => [k, Math.floor(rnd() * 20)]));
      const start = totals(sim);
      for (let step = 0; step < 120; step++) {
        const before = new Map(NAMES3.map((n) => [n, { ...sim.getPlayer(n)!.inv }]));
        const trades = structuredClone(priv(sim).trades);
        const who = pick(players);
        const other = pick(players);
        const r = rnd();
        if (r < 0.15) sim.handle(who, { t: 'tradeAsk', to: other });
        else if (r < 0.3) sim.handle(who, { t: 'tradeAnswer', yes: rnd() < 0.7 });
        else if (r < 0.5) sim.handle(who, { t: 'tradeOffer', lines: lines() });
        else if (r < 0.75) sim.handle(who, { t: 'tradeOk' });
        else if (r < 0.8) sim.handle(who, { t: 'tradeCancel' });
        else if (r < 0.9) sim.getPlayer(who)!.x += (rnd() - 0.5) * 8;
        else if (r < 0.94) sim.markAway(who);
        else if (r < 0.97) sim.connect(who);
        else if (r < 0.98) priv(sim).kill(sim.getPlayer(who)!);
        else sim.time += rnd() * 30;
        if (rnd() < 0.3) sim.step(0.1);
        sim.drain();
        expect(totals(sim)).toEqual(start);
        for (const n of NAMES3) {
          const now = sim.getPlayer(n)!.inv;
          expect(Object.values(now).every((v) => Number.isInteger(v) && v! >= 0)).toBe(true);
          const was = before.get(n)!;
          if (ITEMS.every((k) => (now[k] ?? 0) === (was[k] ?? 0))) continue;
          const t = trades.find((x) => x.a === n || x.b === n)!;
          expect(t).toBeDefined();
          const give = offerInv(t.a === n ? t.la : t.lb);
          const get = offerInv(t.a === n ? t.lb : t.la);
          for (const k of ITEMS) expect(now[k] ?? 0).toBe((was[k] ?? 0) - (give[k] ?? 0) + (get[k] ?? 0));
        }
      }
    }
  });
});
