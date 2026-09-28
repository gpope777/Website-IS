import { describe, expect, it } from 'vitest';
import { ECHO } from '../echo';
import { PROTOCOL_VERSION } from '../protocol';
import { newWorld, WorldSim } from './world-sim';

const MIN = 60 * 1000;

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n, 1_000);
  }
  sim.drain();
  return sim;
}
type Priv = { cleanse(id: number, text: string): void; echo(kind: string, who: string[], what?: string): void; invasion: string; invasion2: string; purified2: boolean; zones: { id: number; x: number; z: number; r: number }[] };
const priv = (sim: WorldSim) => sim as unknown as Priv;
const snap = (sim: WorldSim, who: string) => {
  const m = sim.snapshotFor(who);
  if (!m || m.t !== 'snap') throw new Error('snap');
  return m;
};
const echoes = (sim: WorldSim, who: string) => sim.drain().flatMap((o) => (o.to === who && o.msg.t === 'echo' ? [o.msg.lines] : []));
const toasts = (sim: WorldSim, who: string) => sim.drain().flatMap((o) => (o.to === who && o.msg.t === 'toast' ? [o.msg.text] : []));

describe('Guía y eco (P7-D, server)', () => {
  it('protocol 65', () => {
    expect(PROTOCOL_VERSION).toBe(65);
  });

  it('the snapshot carries the story', () => {
    const sim = setup('Ana');
    expect(snap(sim, 'Ana').story).toEqual({ inv: [0, 0, 0], bosses: [false, false, false, false] });
    priv(sim).invasion = 'done';
    priv(sim).invasion2 = 'taken';
    priv(sim).purified2 = true;
    expect(snap(sim, 'Ana').story).toEqual({ inv: [2, 2, 0], bosses: [false, true, false, false] });
  });

  it('a cleansed zone is logged with who was near and where', () => {
    const sim = setup('Ana', 'Bea');
    const zn = priv(sim).zones.find((z) => z.id === 10)!;
    const bea = sim.getPlayer('Bea')!;
    bea.x = zn.x;
    bea.z = zn.z;
    priv(sim).cleanse(10, 'x');
    expect(sim.echoEvents.at(-1)).toMatchObject({ kind: 'zone', who: ['Bea'], what: 'del Pantano' });
  });

  it('coming back after 31 min shows what the others did, with the Puesto inside', () => {
    const sim = setup('Ana', 'Bea');
    sim.markAway('Ana', 10 * MIN);
    sim.step(1);
    priv(sim).echo('mount', ['Bea'], 'la Rana');
    priv(sim).echo('zone', ['Bea'], 'del Pantano');
    priv(sim).echo('zone', ['Bea'], 'del Pantano');
    sim.getPlayer('Ana')!.soldSince = 3;
    sim.connect('Ana', 41 * MIN + 1);
    const out = sim.drain();
    const ec = out.flatMap((o) => (o.to === 'Ana' && o.msg.t === 'echo' ? [o.msg.lines] : []));
    expect(ec).toEqual([['Bea domó a la Rana.', 'Bea limpió 2 zonas del Pantano.', 'Tu puesto vendió 3 veces.']]);
    expect(out.some((o) => o.to === 'Ana' && o.msg.t === 'toast' && o.msg.text.includes('vendió'))).toBe(false);
    expect(sim.getPlayer('Ana')!.soldSince).toBeUndefined();
  });

  it('no eco after 10 min, or with only my own events, or on an old save', () => {
    const sim = setup('Ana', 'Bea');
    sim.markAway('Ana', 10 * MIN);
    sim.step(1);
    priv(sim).echo('mount', ['Bea'], 'la Rana');
    sim.connect('Ana', 20 * MIN);
    expect(echoes(sim, 'Ana')).toEqual([]);

    sim.markAway('Ana', 30 * MIN);
    sim.step(1);
    priv(sim).echo('raid', ['Ana']);
    sim.connect('Ana', 90 * MIN);
    expect(echoes(sim, 'Ana')).toEqual([]);

    // Old save: no `left`, so the sales toast as before.
    const p = sim.getPlayer('Ana')!;
    delete p.left;
    p.soldSince = 2;
    sim.connect('Ana', 200 * MIN);
    expect(toasts(sim, 'Ana')).toContain('Tu puesto vendió 2 veces desde que te fuiste.');
  });

  it('the log keeps 20 and survives nothing (not saved)', () => {
    const sim = setup('Ana');
    for (let i = 0; i < 30; i++) priv(sim).echo('raid', ['Bea']);
    expect(sim.echoEvents).toHaveLength(ECHO.max);
    expect(JSON.stringify(sim.save())).not.toContain('echo');
  });
});
