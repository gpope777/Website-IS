import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../protocol';
import { decodeClient, PROTOCOL_VERSION } from '../protocol';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  sim.drain();
  return sim;
}
const snap = (sim: WorldSim, n: string) => sim.snapshotFor(n) as Extract<ServerMsg, { t: 'snap' }>;
const texts = (sim: WorldSim) => sim.drain().flatMap((o) => (o.msg.t === 'toast' ? [o.msg.text] : []));

describe('P4-C Aspecto (server)', () => {
  it('protocol 57 and look decoding', () => {
    expect(PROTOCOL_VERSION).toBe(61);
    expect(decodeClient(JSON.stringify({ t: 'look', color: 3, hat: 0 }))).toEqual({ t: 'look', color: 3, hat: 0 });
    expect(decodeClient(JSON.stringify({ t: 'look', color: 8, hat: 0 }))).toBeNull();
    expect(decodeClient(JSON.stringify({ t: 'look', color: 0, hat: 10 }))).toBeNull();
    expect(decodeClient(JSON.stringify({ t: 'look', color: '1', hat: 0 }))).toBeNull();
  });

  it('default look; a colour is saved and seen by others', () => {
    const sim = setup('Ana', 'Bea');
    expect(snap(sim, 'Ana').self.look).toEqual({ color: 0, hat: 0 });
    expect(snap(sim, 'Ana').self.hats).toEqual([]);
    expect(snap(sim, 'Bea').players.find((p) => p.name === 'Ana')!.look).toBeUndefined();
    sim.handle('Ana', { t: 'look', color: 5, hat: 0 });
    expect(sim.getPlayer('Ana')!.look).toEqual({ color: 5, hat: 0 });
    expect(snap(sim, 'Bea').players.find((p) => p.name === 'Ana')!.look).toEqual({ color: 5, hat: 0 });
  });

  it('a locked hat is refused, an unlocked one is worn', () => {
    const sim = setup('Ana');
    sim.handle('Ana', { t: 'look', color: 2, hat: 4 });
    expect(texts(sim).join()).toMatch(/Se gana con Piedra/);
    expect(snap(sim, 'Ana').self.look).toEqual({ color: 0, hat: 0 });
    sim.getPlayer('Ana')!.piedra = true;
    expect(snap(sim, 'Ana').self.hats).toContain(4);
    sim.handle('Ana', { t: 'look', color: 2, hat: 4 });
    expect(snap(sim, 'Ana').self.look).toEqual({ color: 2, hat: 4 });
  });

  it('a hand-edited bad look in a save falls back to the default', () => {
    const sim = setup('Ana');
    (sim.getPlayer('Ana') as { look?: unknown }).look = { color: 99, hat: 1 };
    expect(snap(sim, 'Ana').self.look).toEqual({ color: 0, hat: 0 });
  });
});
