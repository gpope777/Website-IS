import { describe, expect, it } from 'vitest';
import { createTerrain } from '../../src/shared/terrain';
import { generateResources, HARVEST, type ResourceSpawn } from '../../src/shared/resources';
import { Client, createWorld, sleep } from './helpers';

const SEED = 4242;
const terrain = createTerrain(SEED);
const trees = generateResources(terrain, SEED)
  .filter((r) => r.kind === 'tree')
  .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));

/** Walks in 0.9 m steps (under the server's 9 m/s anchor + slack) to 1.5 m short of the target. */
async function walkTo(c: Client, from: { x: number; z: number }, to: ResourceSpawn) {
  const pos = { ...from };
  for (;;) {
    const dx = to.x - pos.x;
    const dz = to.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= 1.5 + to.radius) return pos;
    const step = Math.min(0.9, d - 1.5 - to.radius + 0.01);
    pos.x += (dx / d) * step;
    pos.z += (dz / d) * step;
    c.send({ t: 'move', x: pos.x, y: terrain.heightAt(pos.x, pos.z), z: pos.z, yaw: 0, anim: 'walk' });
    await sleep(120);
  }
}

async function chop(c: Client, id: number, times: number) {
  for (let i = 0; i < times; i++) {
    c.send({ t: 'harvest', id });
    await sleep(500);
  }
}

describe('three players', () => {
  it('share gathering and building, and it survives everyone leaving', async () => {
    await createWorld('bots', SEED);
    const [a, b, c] = await Promise.all([Client.open('bots'), Client.open('bots'), Client.open('bots')]);
    await a.join('Gabriel');
    await b.join('Mateo');
    await c.join('Lucas');

    const t1 = trees[0]!;
    const t2 = trees[1]!;
    let pos = await walkTo(a, { x: 0, z: 0 }, t1);
    await chop(a, t1.id, HARVEST.tree.uses);
    for (const cl of [a, b, c]) expect((await cl.next('res')).id).toBe(t1.id);

    pos = await walkTo(a, pos, t2);
    await chop(a, t2.id, 1);
    a.send({ t: 'place', kind: 'wall', x: pos.x + 1.5, z: pos.z, rot: 0 });
    for (const cl of [a, b, c]) expect((await cl.next('built')).s.kind).toBe('wall');

    a.close();
    b.close();
    c.close();
    await sleep(300);

    const again = await Client.open('bots');
    const w = await again.join('Gabriel');
    expect(w.gone).toContain(t1.id);
    expect(w.structures.map((s) => s.kind)).toEqual(['wall']);
    expect(w.self.inv.wood ?? 0).toBe(0);
    const other = await Client.open('bots');
    expect((await other.join('Mateo')).structures).toHaveLength(1);
  });
});
