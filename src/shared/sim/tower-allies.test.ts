import { describe, expect, it } from 'vitest';
import { createTowerAlly, stepTowerAlly, TOWER_ALLY } from './tower-allies';
import { createWolf } from './wolves';
import { createTerrain } from '../terrain';

const t = createTerrain(3);
const rng = () => 0.5;

describe('white allies in the tower', () => {
  it('the Tragón bites a beast near you, then waits', () => {
    const a = createTowerAlly('tragon', { x: 0, z: 0 }, 0);
    const w = createWolf(1, 3, 10, t, rng);
    const hit = stepTowerAlly(a, [{ x: 0, z: 10 }], [w], 0.1);
    expect(hit?.foe).toBe(w);
    expect(hit?.damage).toBe(TOWER_ALLY.tragon.damage);
    expect(stepTowerAlly(a, [{ x: 0, z: 10 }], [w], 0.1)).toBeNull();
    const far = createWolf(2, 30, 30, t, rng);
    expect(stepTowerAlly(createTowerAlly('tragon', { x: 0, z: 0 }, 0), [{ x: 0, z: 10 }], [far], 0.1)).toBeNull();
  });

  it('the Antenón blows a beast off the ledge every 5 s', () => {
    const a = createTowerAlly('antenon', { x: 0, z: 0 }, 0);
    const w = createWolf(1, 5, 10, t, rng);
    expect(stepTowerAlly(a, [{ x: 0, z: 10 }], [w], 0.1)?.damage).toBe(w.hp);
    expect(a.cooldown).toBeCloseTo(TOWER_ALLY.antenon.every);
  });

  it('the Zancudo never attacks but follows you', () => {
    const a = createTowerAlly('zancudo', { x: 0, z: 0 }, 0);
    const w = createWolf(1, 0, 11, t, rng);
    for (let i = 0; i < 40; i++) expect(stepTowerAlly(a, [{ x: 0, z: 10 }], [w], 0.1)).toBeNull();
    expect(Math.hypot(a.x, a.z - 10)).toBeCloseTo(TOWER_ALLY.follow, 1);
  });

  it('the Cucurucho stones a beast within 15 m every 6 s', () => {
    const a = createTowerAlly('cucurucho', { x: 0, z: 0 }, 0);
    const w = createWolf(1, 0, 14, t, rng);
    expect(stepTowerAlly(a, [], [w], 0.1)?.damage).toBe(TOWER_ALLY.cucurucho.damage);
    expect(stepTowerAlly(a, [], [w], 0.1)).toBeNull();
    expect(stepTowerAlly(createTowerAlly('cucurucho', { x: 0, z: 0 }, 0), [], [createWolf(2, 0, 20, t, rng)], 0.1)).toBeNull();
  });
});
