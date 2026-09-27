import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { coastFeatures, createTerrain, HALF, WATER_LEVEL } from '../shared/terrain';
import { FISH, fishFloor, fishStepOk, wildFish } from '../shared/fish';
import { CIENAGA, depthAt, SWIM_MAX_DEPTH } from '../shared/coast';
import { ColliderGrid } from './colliders';
import type { Crag } from '../shared/crags';
import { MOUNT } from '../shared/mount';
import { animFor, createBody, GLIDE, PLAYER_RADIUS, rollInput, SPEED, STAMINA, staminaFor, stepBody, type Body, type MoveInput } from './movement';

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
