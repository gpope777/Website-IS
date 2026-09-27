import { RIM_LINE } from '../shared/corrupt-lands';
import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { coastFeatures, createTerrain, HALF, mountainFeatures, PELDANOS, RIVER, WATER_LEVEL } from '../shared/terrain';
import { FISH, fishFloor, fishStepOk, inBravas, wildFish } from '../shared/fish';
import { FROG, frogStepOk } from '../shared/frog';
import { DRAGON } from '../shared/dragon';
import { seatOffset, WHALE, whaleStepOk, wildWhale } from '../shared/whale';
import { CIENAGA, depthAt, SWIM_MAX_DEPTH } from '../shared/coast';
import { BOG, inBog, ZARZAL } from '../shared/swamp';
import { ColliderGrid } from './colliders';
import type { Crag } from '../shared/crags';
import { MOUNT } from '../shared/mount';
import { animFor, CLIMB_SPEED, createBody, GLIDE, PLAYER_RADIUS, rollInput, SPEED, STAMINA, staminaFor, stepBody, type Body, type MoveInput } from './movement';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const none = () => [];
const fwd: MoveInput = { x: 0, z: -1, sprint: false, jump: false };

function run(input: MoveInput, seconds: number, terrain = flat, nearby: Parameters<typeof stepBody>[5] = none, yaw = 0, crags: Crag[] = [], b: Body = createBody(0, 0, terrain)) {
  let r = stepBody(b, input, yaw, 0, terrain, nearby, crags);
  for (let t = 0; t < seconds; t += 1 / 60) r = stepBody(b, input, yaw, 1 / 60, terrain, nearby, crags);
  return { b, r };
}

describe('stepBody', () => {
  it('moves forward (-z) relative to the camera at walking speed', () => {
    const { b, r } = run(fwd, 2);
    expect(b.z).toBeLessThan(-5);
    expect(Math.abs(b.x)).toBeLessThan(1e-6);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.walk, 1);
    expect(animFor(r, b)).toBe('walk');
    expect(b.facing).toBeCloseTo(Math.PI, 5); // atan2(0, -1)
  });

  it('turns with the camera', () => {
    const { b } = run(fwd, 1, flat, none, Math.PI / 2); // camera looking -x
    expect(b.x).toBeLessThan(-2);
  });

  it('sprints faster', () => {
    const { b, r } = run({ ...fwd, sprint: true }, 2);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.run, 1);
    expect(animFor(r, b)).toBe('run');
  });

  it('is pushed out of colliders', () => {
    const grid = new ColliderGrid();
    grid.add('tree', { x: 0, z: -3, r: 0.5 });
    const { b } = run(fwd, 3, flat, (x, z) => grid.near(x, z));
    expect(Math.hypot(b.x, b.z + 3)).toBeGreaterThanOrEqual(0.5 + PLAYER_RADIUS - 1e-3);
  });

  it('jumps and lands', () => {
    const b = createBody(0, 0, flat);
    stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, flat, none);
    expect(b.onGround).toBe(false);
    for (let i = 0; i < 120; i++) stepBody(b, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, flat, none);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(0);
  });

  it('swims in deep water', () => {
    const lake: Terrain = { heightAt: () => -10, density: () => 0.5 };
    const { b, r } = run(fwd, 0.5, lake);
    expect(r.swimming).toBe(true);
    expect(b.y).toBe(WATER_LEVEL - 0.9);
    expect(animFor(r, b)).toBe('swim');
  });

  it('stays inside the world', () => {
    const b = createBody(HALF - 3.5, 0, flat);
    for (let i = 0; i < 120; i++) stepBody(b, { x: 1, z: 0, sprint: true, jump: false }, 0, 1 / 60, flat, none);
    expect(b.x).toBeLessThanOrEqual(HALF - 3);
  });
});

describe('ColliderGrid', () => {
  it('finds neighbours across cells and forgets removed ones', () => {
    const g = new ColliderGrid(8);
    g.add('a', { x: 7.9, z: 0, r: 1 });
    expect(g.near(8.1, 0)).toHaveLength(1);
    expect(g.near(40, 0)).toHaveLength(0);
    g.remove('a');
    expect(g.near(8.1, 0)).toHaveLength(0);
  });
});

describe('rollInput', () => {
  it('runs along the facing whatever the camera does', () => {
    for (const [facing, cam] of [[0, 0], [1, -2], [Math.PI - 0.2, 0.5]] as const) {
      const b = createBody(0, 0, flat);
      stepBody(b, rollInput(facing, cam), cam, 0.1, flat, none);
      expect(Math.atan2(b.x, b.z)).toBeCloseTo(facing);
    }
  });
});

describe('climbing', () => {
  const crag: Crag = { id: 0, x: 0, z: -3, r: 2, base: -1, top: 8 };
  const idle: MoveInput = { x: 0, z: 0, sprint: false, jump: false };

  it('pushing into a crag grabs it and climbs up, spending stamina', () => {
    const { b, r } = run(fwd, 1, flat, none, 0, [crag]);
    expect(b.climb).toBe(crag);
    expect(b.y).toBeGreaterThan(1);
    expect(b.stamina).toBeLessThan(STAMINA.max);
    expect(r.climbing).toBe(true);
    expect(animFor(r, b)).toBe('climb');
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeCloseTo(crag.r + PLAYER_RADIUS, 3);
  });

  it('climbs over the top and stands on it', () => {
    const { b } = run(fwd, 0.2, flat, none, 0, [crag]);
    for (let i = 0; i < 600 && b.climb; i++) stepBody(b, fwd, 0, 1 / 60, flat, none, [crag]);
    expect(b.climb).toBeNull();
    expect(b.y).toBeCloseTo(crag.top);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeLessThan(crag.r);
    const after = run(idle, 1, flat, none, 0, [crag], b).b;
    expect(after.y).toBeCloseTo(crag.top); // stays up there
  });

  it('lets go when stamina runs out, and stays tired until the meter is full', () => {
    const b = createBody(0, 0, flat);
    b.stamina = 5;
    run(fwd, 1.5, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.tired).toBe(true);
    run(idle, 2, flat, none, 0, [crag], b); // fall to the ground
    expect(b.onGround).toBe(true);
    run(fwd, 0.5, flat, none, 0, [crag], b); // tired: bumps into the rock, no grab
    expect(b.climb).toBeNull();
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeGreaterThanOrEqual(crag.r + PLAYER_RADIUS - 1e-3);
    run(idle, STAMINA.max / STAMINA.regen + 0.2, flat, none, 0, [crag], b);
    expect(b.tired).toBe(false);
    expect(b.stamina).toBe(STAMINA.max);
  });

  it('jump leaps off the wall', () => {
    const { b } = run(fwd, 1, flat, none, 0, [crag]);
    const before = b.stamina;
    run({ ...idle, jump: true }, 0.3, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.stamina).toBeLessThan(before - STAMINA.leap + 1);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeGreaterThan(crag.r + PLAYER_RADIUS + 0.5);
  });

  it('strafing circles the crag at the same distance', () => {
    const { b } = run(fwd, 0.5, flat, none, 0, [crag]);
    const a0 = Math.atan2(b.x - crag.x, b.z - crag.z);
    run({ ...idle, x: 1 }, 1, flat, none, 0, [crag], b);
    expect(b.climb).toBe(crag);
    expect(Math.atan2(b.x - crag.x, b.z - crag.z)).toBeGreaterThan(a0 + 0.3);
    expect(Math.hypot(b.x - crag.x, b.z - crag.z)).toBeCloseTo(crag.r + PLAYER_RADIUS, 3);
  });

  it('climbing down to the foot puts you back on the ground', () => {
    const { b } = run(fwd, 1, flat, none, 0, [crag]);
    run({ ...idle, z: 1 }, 2, flat, none, 0, [crag], b);
    expect(b.climb).toBeNull();
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(0);
  });
});

describe('glider', () => {
  const idle: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
  const press: MoveInput = { ...fwd, jump: true };
  function high() {
    const b = createBody(0, 0, flat);
    b.y = 20;
    b.onGround = false;
    return b;
  }

  it('a fresh jump press in the air opens it: slow sink, forward drift', () => {
    const b = high();
    const { r } = run(press, 0, flat, none, 0, [], b);
    expect(b.gliding).toBe(true);
    const out = run(fwd, 1, flat, none, 0, [], b);
    expect(b.vy).toBeCloseTo(-GLIDE.sink);
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(GLIDE.speed * 0.8);
    expect(b.y).toBeGreaterThan(20 - GLIDE.sink * 1.2);
    expect(b.stamina).toBeLessThan(STAMINA.max);
    expect(animFor(out.r, b)).toBe('glide');
    expect(r.gliding).toBe(true);
  });

  it('keeps drifting along the facing with the stick idle', () => {
    const b = high();
    run(press, 0, flat, none, 0, [], b);
    run(idle, 1, flat, none, 0, [], b);
    expect(b.z).toBeLessThan(-4); // facing -z from the press
  });

  it('closes on a second press, on landing, and when stamina runs out', () => {
    const b = high();
    run(press, 0, flat, none, 0, [], b);
    run(fwd, 0.1, flat, none, 0, [], b);
    run(press, 0, flat, none, 0, [], b);
    expect(b.gliding).toBe(false);

    const c = high();
    run(press, 0, flat, none, 0, [], c);
    run(fwd, 15, flat, none, 0, [], c);
    expect(c.onGround).toBe(true);
    expect(c.gliding).toBe(false);

    const d = high();
    d.stamina = 2;
    run(press, 0, flat, none, 0, [], d);
    run(fwd, 1, flat, none, 0, [], d);
    expect(d.gliding).toBe(false);
    expect(d.tired).toBe(true);
  });

  it('holding jump does not open it, and it needs some height', () => {
    const b = high();
    b.jumpHeld = true;
    run(press, 0.2, flat, none, 0, [], b);
    expect(b.gliding).toBe(false);

    const low = createBody(0, 0, flat);
    run(press, 0.05, flat, none, 0, [], low); // jump from the ground...
    run(fwd, 0, flat, none, 0, [], low);
    run(press, 0, flat, none, 0, [], low); // ...and press again at once: too low
    expect(low.gliding).toBe(false);
  });

  it('grabs a crag it glides into', () => {
    const crag: Crag = { id: 0, x: 0, z: -6, r: 2, base: -1, top: 30 };
    const b = high();
    run(press, 0, flat, none, 0, [crag], b);
    run(fwd, 1.5, flat, none, 0, [crag], b);
    expect(b.climb).toBe(crag);
    expect(b.gliding).toBe(false);
  });
});

describe('fast swimming', () => {
  const lake: Terrain = { heightAt: () => -10, density: () => 0.5 };
  it('sprinting in water is faster and costs stamina', () => {
    const { b } = run({ ...fwd, sprint: true }, 1, lake);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.swimFast, 1);
    expect(b.stamina).toBeLessThan(STAMINA.max);
  });
  it('a tired swimmer is back to the slow stroke and recovers', () => {
    const b = createBody(0, 0, lake);
    b.stamina = 3;
    run({ ...fwd, sprint: true }, 1, lake, none, 0, [], b);
    expect(b.tired).toBe(true);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(SPEED.swim, 1);
    run({ ...fwd, sprint: true }, 4, lake, none, 0, [], b);
    expect(b.tired).toBe(false);
  });
});

describe('Enredadera and orbs', () => {
  const idle: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
  const rock: Crag = { id: 1000, x: 0, z: -3, r: 2, base: -1, top: 8, bare: true };

  it('a bare rock cannot be grabbed, only bumped into', () => {
    const { b } = run(fwd, 1, flat, none, 0, [rock]);
    expect(b.climb).toBeNull();
    expect(Math.hypot(b.x - rock.x, b.z - rock.z)).toBeGreaterThanOrEqual(rock.r + PLAYER_RADIUS - 1e-3);
  });

  it('you can still stand on top of a bare rock', () => {
    const b = createBody(0, -3, flat);
    b.y = rock.top;
    run(idle, 1, flat, none, 0, [rock], b);
    expect(b.y).toBeCloseTo(rock.top);
  });

  it('each orb adds stamina, and the meter refills to the bigger max', () => {
    expect(staminaFor(0)).toBe(STAMINA.max);
    expect(staminaFor(2)).toBe(STAMINA.max + 2 * STAMINA.perOrb);
    const b = createBody(0, 0, flat);
    expect(b.staminaMax).toBe(STAMINA.max);
    b.staminaMax = staminaFor(2);
    b.stamina = 0;
    b.tired = true;
    run(idle, STAMINA.max / STAMINA.regen + 0.2, flat, none, 0, [], b);
    expect(b.tired).toBe(true);
    run(idle, 2, flat, none, 0, [], b);
    expect(b.stamina).toBe(staminaFor(2));
    expect(b.tired).toBe(false);
  });

  it('a custom bounds function clamps the step (dungeon walls)', () => {
    const b = createBody(0, 0, flat);
    const wall = (_px: number, _pz: number, nx: number, nz: number) => ({ x: nx, z: Math.max(-1, nz) });
    for (let t = 0; t < 2; t += 1 / 60) stepBody(b, fwd, 0, 1 / 60, flat, none, [], wall);
    expect(b.z).toBe(-1);
  });
});

describe('riding', () => {
  const mounted = (terrain = flat) => {
    const b = createBody(0, 0, terrain);
    b.riding = true;
    return b;
  };
  it('the deer walks and runs faster than you', () => {
    expect(Math.hypot(run(fwd, 2, flat, none, 0, [], mounted()).b.vz, 0)).toBeCloseTo(MOUNT.walk, 1);
    const { b, r } = run({ ...fwd, sprint: true }, 2, flat, none, 0, [], mounted());
    expect(Math.abs(b.vz)).toBeCloseTo(MOUNT.run, 1);
    expect(animFor(r, b)).toBe('run');
  });
  it('stops at the shore', () => {
    const shore: Terrain = { heightAt: (_x, z) => (z < -3 ? WATER_LEVEL - 3 : 1), density: () => 0.5 };
    const { b, r } = run(fwd, 3, shore, none, 0, [], mounted(shore));
    expect(b.z).toBeGreaterThan(-3.2);
    expect(r.swimming).toBe(false);
  });
  it('does not grab crags nor open the glider', () => {
    const crag: Crag = { id: 1, x: 0, z: -3, r: 1, base: 0, top: 10 };
    const { b } = run(fwd, 2, flat, none, 0, [crag], mounted());
    expect(b.climb).toBeNull();
    const air = mounted();
    air.y = 5;
    air.onGround = false;
    stepBody(air, { ...fwd, jump: true }, 0, 1 / 60, flat, none);
    expect(air.gliding).toBe(false);
  });
});

describe('the coast', () => {
  const t = createTerrain(42);
  const south: MoveInput = { x: 0, z: 1, sprint: true, jump: false }; // camera yaw 0: +z is "back"

  it('wading through the Ciénaga is slow, even sprinting; the deer is not slowed', () => {
    const { b } = run(south, 1, t, none, 0, [], createBody(0, HALF, t));
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(CIENAGA.speed, 1);
    const deer = createBody(0, HALF, t);
    deer.riding = true;
    run(south, 1, t, none, 0, [], deer);
    expect(Math.hypot(deer.vx, deer.vz)).toBeCloseTo(MOUNT.run, 0);
  });

  it('el Zarzal holds walkers and the deer to 3 m/s', () => {
    const west: MoveInput = { x: -1, z: 0, sprint: true, jump: false };
    const { b } = run(west, 1, t, none, 0, [], createBody(-HALF - 30, 100, t));
    expect(Math.hypot(b.vx, b.vz)).toBeLessThanOrEqual(ZARZAL.speed + 0.01);
    const deer = createBody(-HALF - 30, 100, t);
    deer.riding = true;
    run(west, 1, t, none, 0, [], deer);
    expect(Math.hypot(deer.vx, deer.vz)).toBeLessThanOrEqual(ZARZAL.speed + 0.01);
  });

  it('the bog slows walkers to 60 %', () => {
    let z = 60;
    while (!(inBog(t, -HALF - 90, z) && inBog(t, -HALF - 90, z + 1))) z++;
    const b = createBody(-HALF - 90, z, t);
    const walk: MoveInput = { ...south, sprint: false };
    for (let i = 0; i < 7; i++) stepBody(b, walk, 0, 1 / 60, t, none);
    const v = Math.hypot(b.vx, b.vz);
    expect(v).toBeLessThanOrEqual(SPEED.walk * BOG.k + 0.01);
    expect(v).toBeGreaterThan(SPEED.walk * BOG.k * 0.7);
    const r = createBody(-HALF - 90, z, t);
    for (let i = 0; i < 7; i++) stepBody(r, south, 0, 1 / 60, t, none);
    expect(Math.hypot(r.vx, r.vz)).toBeLessThanOrEqual(SPEED.run * BOG.k + 0.01);
  });

  it('in the river a swimmer drifts down to the sea but cannot swim up it', () => {
    const east: MoveInput = { x: 1, z: 0, sprint: false, jump: false };
    const west: MoveInput = { x: -1, z: 0, sprint: false, jump: false };
    const down = run(east, 1, t, none, 0, [], createBody(-HALF - 20, RIVER.z, t)).b;
    expect(down.x).toBeGreaterThan(-HALF - 19);
    const up = run(west, 1, t, none, 0, [], createBody(-HALF - 20, RIVER.z, t)).b;
    expect(up.x).toBeCloseTo(-HALF - 20, 1);
  });

  it('the map edge lets you walk from the forest into the swamp', () => {
    const west: MoveInput = { x: -1, z: 0, sprint: false, jump: false };
    const { b } = run(west, 3, flat, none, 0, [], createBody(-HALF + 3, 100, flat));
    expect(b.x).toBeLessThan(-HALF - 3);
  });

  it('the current stops a swimmer heading out to the deep sea', () => {
    const x = -HALF + 45;
    const { b } = run(south, 20, t, none, 0, [], createBody(x, HALF + 80, t));
    expect(depthAt(t, b.x, b.z)).toBeLessThanOrEqual(SWIM_MAX_DEPTH + 0.2);
    expect(b.z).toBeGreaterThan(HALF + 85);
  });
});

describe('riding the giant fish', () => {
  const t = createTerrain(42);
  const { island } = coastFeatures(42);
  const home = wildFish(t, 42);
  const onFish = (x = home.x, z = home.z) => {
    const b = createBody(x, z, t);
    b.y = WATER_LEVEL - 0.9;
    b.fish = island;
    return b;
  };
  const along = { x: 1, z: 0, sprint: false, jump: false }; // camera yaw 0: +x

  it('swims at 9, sprints at 14 without stamina', () => {
    let { b } = run(along, 1.5, t, none, 0, [], onFish());
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(FISH.walk, 0);
    ({ b } = run({ ...along, sprint: true }, 1.5, t, none, 0, [], onFish()));
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(FISH.run, 0);
    expect(b.stamina).toBe(STAMINA.max);
  });

  it('stops at the shore', () => {
    const b = onFish();
    run({ x: 0, z: -1, sprint: true, jump: false }, 8, t, none, 0, [], b); // camera yaw 0: forward is -z, toward the beach
    expect(fishStepOk(t, island, b.x, b.z)).toBe(true);
    expect(b.z).toBeGreaterThan(HALF + 40);
  });

  it('B held dives to the seabed; letting go floats up', () => {
    const b = onFish();
    run({ x: 0, z: 0, sprint: false, jump: true }, 0.5, t, none, 0, [], b);
    expect(b.y).toBeCloseTo(WATER_LEVEL - 0.9 - FISH.sink * 0.5, 0);
    run({ x: 0, z: 0, sprint: false, jump: true }, 10, t, none, 0, [], b);
    expect(b.y).toBeCloseTo(fishFloor(t, b.x, b.z), 1);
    run({ x: 0, z: 0, sprint: false, jump: false }, 10, t, none, 0, [], b);
    expect(b.y).toBeCloseTo(WATER_LEVEL - 0.9, 5);
  });
});

describe('piloting the whale', () => {
  const t = createTerrain(42);
  const { island } = coastFeatures(42);
  const home = wildWhale(t, 42);
  const aboard = (x = home.x, z = home.z) => {
    const b = createBody(x, z, t);
    b.y = WATER_LEVEL;
    b.whale = true;
    return b;
  };
  const along = { x: 1, z: 0, sprint: false, jump: false };

  it('swims at 5, 7 sprinting, on the surface', () => {
    let { b } = run(along, 2, t, none, 0, [], aboard());
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(WHALE.walk, 0);
    expect(b.y).toBe(WATER_LEVEL);
    ({ b } = run({ ...along, sprint: true }, 2, t, none, 0, [], aboard()));
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(WHALE.run, 0);
  });

  it('stops before shallow water', () => {
    const b = aboard();
    run({ x: 0, z: -1, sprint: true, jump: false }, 40, t, none, 0, [], b);
    const off = seatOffset(0, b.facing);
    expect(whaleStepOk(t, b.x - off.x, b.z - off.z)).toBe(true);
  });

  it('goes into the aguas bravas', () => {
    const b = aboard(island.x, island.z - (island.r + FISH.bravas + 3));
    run({ x: 0, z: 1, sprint: false, jump: false }, 2, t, none, 0, [], b); // camera yaw 0: +z is back… toward the island
    expect(inBravas(island, b.x, b.z)).toBe(true);
  });
});

describe('Viento lift (S2-F)', () => {
  const flat: Terrain = { heightAt: () => 0, density: () => 0 };
  const still: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
  it('lifts a glider 6 m once per flight; landing resets it', async () => {
    const { boost } = await import('./movement');
    const { VIENTO } = await import('../shared/viento');
    const b = createBody(0, 0, flat);
    expect(boost(b)).toBe(false); // on the ground: nothing
    Object.assign(b, { y: 10, onGround: false, gliding: true });
    expect(boost(b)).toBe(true);
    for (let i = 0; i < 10; i++) stepBody(b, still, 0, 0.1, flat, () => []);
    expect(b.y).toBeCloseTo(10 + VIENTO.boost - GLIDE.sink * 1, 0);
    expect(boost(b)).toBe(false);
    for (let i = 0; i < 100 && !b.onGround; i++) stepBody(b, still, 0, 0.1, flat, () => []);
    expect(b.boosted).toBe(false);
  });
});

describe('riding la Rana', () => {
  const frogBody = (terrain: Terrain = flat, x = 0, z = 0) => {
    const b = createBody(x, z, terrain);
    b.frog = true;
    return b;
  };

  it('runs 8 m/s, 11 sprinting, without spending stamina', () => {
    const { b } = run(fwd, 2, flat, none, 0, [], frogBody());
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(FROG.walk, 1);
    const s = run({ ...fwd, sprint: true }, 2, flat, none, 0, [], frogBody());
    expect(Math.hypot(s.b.vx, s.b.vz)).toBeCloseTo(FROG.run, 1);
    expect(s.b.stamina).toBe(STAMINA.max);
  });

  it('the bog does not slow it', () => {
    const t = createTerrain(42);
    let spot: { x: number; z: number } | null = null;
    for (let z = 80; z < HALF && !spot; z += 3) for (let x = -HALF - 80; x > -HALF - 160 && !spot; x -= 3) if ([0, 4, 8, 12, 16].every((k) => inBog(t, x, z - k))) spot = { x, z };
    const { b } = run(fwd, 1, t, none, 0, [], frogBody(t, spot!.x, spot!.z));
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(FROG.walk * 0.9);
    expect(b.y).toBeGreaterThanOrEqual(WATER_LEVEL - 1e-6);
  });

  it('stops before water deeper than 2 m', () => {
    const deepAhead: Terrain = { heightAt: (_x, z) => (z < -5 ? WATER_LEVEL - 4 : 0), density: () => 0.5 };
    const { b } = run(fwd, 3, deepAhead, none, 0, [], frogBody(deepAhead));
    expect(b.z).toBeGreaterThan(-5);
    expect(frogStepOk(deepAhead, b.x, b.z)).toBe(true);
  });

  it('B jumps about 7 m up and 9 m forward, then waits out the cooldown', () => {
    const b = frogBody();
    let top = 0;
    stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, flat, none);
    expect(b.onGround).toBe(false);
    for (let i = 0; i < 400 && !b.onGround; i++) {
      stepBody(b, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, flat, none);
      top = Math.max(top, b.y);
    }
    expect(top).toBeGreaterThan(FROG.hop.up - 0.5);
    expect(top).toBeLessThan(FROG.hop.up + 0.5);
    expect(Math.hypot(b.x, b.z)).toBeGreaterThan(FROG.hop.fwd - 1);
    expect(Math.hypot(b.x, b.z)).toBeLessThan(FROG.hop.fwd + 1);
    // Landed: a fresh press right away does nothing until the cooldown is over.
    const c = frogBody();
    stepBody(c, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, flat, none);
    c.onGround = true;
    c.y = 0;
    c.vy = 0;
    stepBody(c, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, flat, none);
    stepBody(c, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, flat, none);
    expect(c.onGround).toBe(true);
  });

  it('hops over deep water onto a lily pad (S3-C)', () => {
    const lake: Terrain = { heightAt: (_x, z) => (z > 2 ? WATER_LEVEL - 6 : 0), density: () => 0.5 };
    const pad = { id: 1200, x: 0, z: FROG.hop.fwd, r: 1.1, base: WATER_LEVEL - 1, top: WATER_LEVEL + 0.15, bare: true };
    const b = frogBody(lake);
    stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, lake, none, [pad]);
    for (let i = 0; i < 400 && !b.onGround; i++) stepBody(b, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, lake, none, [pad]);
    expect(Math.hypot(b.x - pad.x, b.z - pad.z)).toBeLessThan(pad.r + 0.5);
    expect(b.y).toBeCloseTo(pad.top, 1);
  });

  it('floats on shallow water', () => {
    const shallow: Terrain = { heightAt: () => WATER_LEVEL - 1.5, density: () => 0.5 };
    const { b, r } = run(fwd, 1, shallow, none, 0, [], frogBody(shallow));
    expect(b.y).toBeCloseTo(WATER_LEVEL, 5);
    expect(r.swimming).toBe(false);
  });
});

describe('las Montañas', () => {
  const t = createTerrain(42);
  const zd = (d: number) => -HALF - d;
  const E = t.heightAt(0, -HALF + 0.001);

  it('on foot and on the deer, los Peldaños stop you; back down is fine', () => {
    for (const riding of [false, true]) {
      const b = createBody(0, -HALF + 3, t);
      b.riding = riding;
      const { r } = run(fwd, 3, t, none, 0, [], b);
      expect(b.y).toBeLessThan(E + 1);
      expect(r.steep).toBe('smooth');
      const back = run({ ...fwd, z: 1 }, 1, t, none, 0, [], b);
      expect(back.b.z).toBeGreaterThan(-HALF + 1);
    }
  });

  it('the deer does not climb a pared', () => {
    const p = mountainFeatures(42).paredes[0]!;
    const b = createBody(p.x + p.rt + p.w + 2, p.z, t);
    b.riding = true;
    const res = run(fwd, 3, t, none, Math.PI / 2, [], b); // camera looking −x
    expect(res.r.steep).toBe('deer');
    expect(b.y).toBeLessThan(t.heightAt(p.x, p.z) - p.h / 2);
  });

  it('the frog cannot walk up, but four well-placed high jumps climb los Peldaños', () => {
    const b = createBody(0, -HALF + 3, t);
    b.frog = true;
    run(fwd, 2, t, none, 0, [], b);
    expect(b.y).toBeLessThan(E + 1);
    for (let k = 0; k < PELDANOS.steps; k++) {
      b.z = zd(PELDANOS.first + PELDANOS.pitch * k - 3.5);
      b.y = t.heightAt(b.x, b.z);
      Object.assign(b, { vx: 0, vz: 0, vy: 0, onGround: true, hopCd: 0, facing: Math.PI });
      stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, 0, 1 / 60, t, none);
      for (let i = 0; i < 400 && !b.onGround; i++) stepBody(b, { x: 0, z: 0, sprint: false, jump: false }, 0, 1 / 60, t, none);
      expect(b.y).toBeCloseTo(E + PELDANOS.rise * (k + 1), 0);
    }
    expect(b.y - E).toBeGreaterThan(23);
  });

  it('walks across the seam onto the first terrace floor', () => {
    const b = createBody(0, -HALF + 2, t);
    run(fwd, 0.9, t, none, 0, [], b);
    expect(b.z).toBeLessThan(-HALF - 0.3);
  });

  describe('climbing mountain rock (S4-B)', () => {
    const p = mountainFeatures(42).paredes[0]!;
    const foot = () => createBody(p.x + p.rt + p.w + 2, p.z, t);
    const west = Math.PI / 2; // camera looking −x, toward the pared

    it('pushing into a dry pared grabs it and climbs it with stamina, then stands on top', () => {
      const b = foot();
      const start = b.y;
      let r = run(fwd, 1.5, t, none, west, [], b).r;
      expect(r.climbing).toBe(true);
      expect(b.wall).toBe(true);
      expect(b.y).toBeGreaterThan(start + 1);
      expect(b.stamina).toBeLessThan(STAMINA.max);
      b.staminaMax = b.stamina = 1000;
      for (let i = 0; i < 60 * 20 && b.wall; i++) r = stepBody(b, fwd, west, 1 / 60, t, none);
      expect(b.wall).toBe(false);
      expect(b.onGround).toBe(true);
      expect(b.y).toBeGreaterThan(t.heightAt(p.x, p.z) - 1.5);
    });

    it('climbs no faster than CLIMB_SPEED', () => {
      const b = foot();
      run(fwd, 1, t, none, west, [], b);
      const y0 = b.y;
      run(fwd, 1, t, none, west, [], b);
      expect(b.y - y0).toBeLessThanOrEqual(CLIMB_SPEED + 0.05);
    });

    it('out of stamina you let go and slide down', () => {
      const b = foot();
      run(fwd, 1.5, t, none, west, [], b);
      expect(b.wall).toBe(true);
      b.stamina = 0.01;
      run({ x: 0, z: 0, sprint: false, jump: false }, 0.1, t, none, west, [], b);
      expect(b.wall).toBe(false);
      const hi = b.y;
      run({ x: 0, z: 0, sprint: false, jump: false }, 2, t, none, west, [], b);
      expect(b.y).toBeLessThan(hi - 1);
    });

    it('B jumps off backwards and costs stamina', () => {
      const b = foot();
      run(fwd, 1.5, t, none, west, [], b);
      const s0 = b.stamina;
      const x0 = b.x;
      stepBody(b, { x: 0, z: 0, sprint: false, jump: true }, west, 1 / 60, t, none);
      expect(b.wall).toBe(false);
      expect(b.stamina).toBeLessThan(s0 - STAMINA.leap + 1);
      run({ x: 0, z: 0, sprint: false, jump: false }, 0.3, t, none, west, [], b);
      expect(b.x).toBeGreaterThan(x0); // away from the pared (it is to the west)
    });

    it('wet rock cannot be grabbed; smooth Peldaños still say so', () => {
      const b = foot();
      b.wet = true;
      const { r } = run(fwd, 1.5, t, none, west, [], b);
      expect(b.wall).toBe(false);
      expect(r.steep).toBe('wet');
      const c = createBody(0, -HALF + 3, t);
      expect(run(fwd, 2, t, none, 0, [], c).r.steep).toBe('smooth');
    });
  });
});


describe('flying el Dragón', () => {
  const dragonBody = (x = 0, z = 0, y = 0) => {
    const b = createBody(x, z, flat);
    b.dragon = true;
    b.y = y;
    return b;
  };

  it('15 m/s along the stick; B held climbs 4 m/s, released sinks 2 m/s; no stamina', () => {
    const { b } = run({ ...fwd, jump: true }, 2, flat, none, 0, [], dragonBody());
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(DRAGON.fly, 0);
    expect(b.y).toBeCloseTo(DRAGON.climb * 2, 0);
    expect(b.stamina).toBe(STAMINA.max);
    const y0 = b.y;
    run(fwd, 1, flat, none, 0, [], b);
    expect(b.y).toBeCloseTo(y0 - DRAGON.sink, 0);
  });

  it('never above ground + 35; lands on the ground', () => {
    const { b } = run({ ...fwd, jump: true }, 12, flat, none, 0, [], dragonBody());
    expect(b.y).toBeLessThanOrEqual(DRAGON.ceil + 1e-6);
    run(fwd, 20, flat, none, 0, [], b);
    expect(b.y).toBe(0);
    expect(b.onGround).toBe(true);
  });

  it('the fog turns it back, and near the Heart in a raid it keeps 6 m up', () => {
    const b = dragonBody(0, -HALF - 199, 10);
    run({ ...fwd, jump: true }, 1, flat, none, 0, [], b);
    expect(b.z).toBeGreaterThanOrEqual(-HALF - 200);
    const c = dragonBody(0, 0, 10);
    c.noLand = true;
    run(fwd, 10, flat, none, 0, [], c);
    expect(c.y).toBeCloseTo(6, 1);
  });
});

describe('tobogán de nieve (S4-H)', () => {
  const z0 = -HALF - 100;
  /** Snowy mountain slope at x ≈ 40 (off the chute): downhill is +z, flat from zFlat on, height 100 at z0. */
  const slope = (deg: number, zFlat = Infinity, low = -1000): Terrain => ({
    heightAt: (_x, z) => Math.max(low, 100 - Math.tan((deg * Math.PI) / 180) * (Math.min(z, zFlat) - z0)),
    density: () => 0.5,
  });
  const runSide: MoveInput = { x: 1, z: 0, sprint: true, jump: false };
  const start = (t: Terrain) => {
    const b = createBody(40, z0, t);
    stepBody(b, runSide, 0, 1 / 60, t, none);
    const r = stepBody(b, { ...runSide, jump: true }, 0, 1 / 60, t, none);
    return { b, r };
  };
  const go = (b: Body, t: Terrain, input: MoveInput, s: number, nearby: Parameters<typeof stepBody>[5] = none) => {
    let r = stepBody(b, input, 0, 1 / 60, t, nearby);
    for (let k = 0; k < s * 60; k++) r = stepBody(b, input, 0, 1 / 60, t, nearby);
    return r;
  };

  it('B while running on steep snow: a belly slide downhill up to 14 m/s', () => {
    const t = slope(25, Infinity, -1000);
    const { b, r } = start(t);
    expect(b.sliding).toBe(true);
    expect(animFor(r, b)).toBe('slide');
    const r2 = go(b, t, { x: 0, z: 0, sprint: false, jump: false }, 3);
    expect(b.sliding).toBe(true);
    expect(animFor(r2, b)).toBe('slide');
    expect(b.vz).toBeCloseTo(14, 0);
    expect(b.onGround).toBe(true);
    expect(b.y).toBeCloseTo(t.heightAt(b.x, b.z), 3);
  });
  it('on a gentle slope B is still a jump', () => {
    const { b } = start(slope(10, Infinity, -1000));
    expect(b.sliding).toBeFalsy();
    expect(b.onGround).toBe(false);
  });
  it('the stick steers at most 30°', () => {
    const t = slope(25, Infinity, -1000);
    const { b } = start(t);
    go(b, t, { x: 1, z: 0, sprint: false, jump: false }, 2);
    expect(Math.abs(Math.atan2(b.vx, b.vz))).toBeLessThanOrEqual(Math.PI / 6 + 1e-6);
    expect(b.vx).toBeGreaterThan(1);
  });
  it('B again gets you up', () => {
    const t = slope(25, Infinity, -1000);
    const { b } = start(t);
    go(b, t, { x: 0, z: 0, sprint: false, jump: false }, 0.5);
    go(b, t, { x: 0, z: 0, sprint: false, jump: true }, 0);
    expect(b.sliding).toBe(false);
  });
  it('stops on a flat after about 1 s, off snow, or at a tree', () => {
    const flatAt = z0 + 20;
    const t = slope(25, flatAt);
    const { b } = start(t);
    go(b, t, { x: 0, z: 0, sprint: false, jump: false }, 8);
    expect(b.sliding).toBe(false);
    expect(b.z).toBeGreaterThan(flatAt + 5);
    const low = slope(25, Infinity, -1000); // runs below 55 m: off snow
    const s = start(low).b;
    go(s, low, { x: 0, z: 0, sprint: false, jump: false }, 10);
    expect(s.sliding).toBe(false);
    expect(low.heightAt(s.x, s.z)).toBeLessThan(60);
    const tree = start(t).b;
    go(tree, t, { x: 0, z: 0, sprint: false, jump: false }, 3, () => [{ x: 40, z: z0 + 8, r: 0.5 }]);
    expect(tree.sliding).toBe(false);
    expect(tree.z).toBeLessThan(z0 + 8);
  });
  it('the chute carries you from the Cumbre down to the Umbral', () => {
    const t = createTerrain(42);
    const b = createBody(0, -HALF - 140, t);
    b.sliding = true;
    go(b, t, { x: 0, z: 0, sprint: false, jump: false }, 25);
    expect(b.sliding).toBe(false);
    expect(Math.abs(b.x)).toBeLessThan(2);
    expect(b.z).toBeGreaterThan(-HALF - 2);
    expect(b.z).toBeLessThan(-HALF + 4);
  });
});

describe('las Tierras Corruptas (S5-A)', () => {
  const t = createTerrain(42);
  it('walking north stops at the rim line', () => {
    const b = createBody(0, RIM_LINE + 1, t);
    b.y = t.heightAt(0, RIM_LINE + 1);
    b.wet = true; // no grabbing the rim's rock
    const { r } = run(fwd, 2, t, none, 0, [], b);
    expect(b.z).toBeGreaterThanOrEqual(RIM_LINE);
    expect(r.steep).toBe('rim');
  });
});
