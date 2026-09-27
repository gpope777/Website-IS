# Aventura A — Corazón del Bosque y asedios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players plant a shared Corazón del Bosque. Every dusk, El Marchito warns of a raid from one direction, and at nightfall a wave of corrupted beasts marches on the Heart, chewing through walls and dying on spikes. Surviving the night raises the siege level; letting the Heart reach 0 withers it until the players tend it with berries.

**Architecture:** All rules live in `src/shared` (pure TS, unit-tested with vitest): new structure kinds and HP in `items.ts`, a `stepRaider` AI in `sim/wolves.ts` that reuses the wolf, and the raid lifecycle inside `WorldSim`. Raid and Heart state ride on the existing 10 Hz `snap`. Structure damage and destruction are one-off events (`hit`, `wrecked`). The client adds meshes, a Heart bar, a raid banner with a direction arrow and a purple sky tint.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects (`@cloudflare/vitest-plugin` for worker tests).

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` (sections 3, 4 and 12). Foundation spec: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`.

## Slice 1 plan map (this is Plan A)

Slice 1 is split into independent plans, each playable on its own:

| Plan | Delivers |
|---|---|
| **A (this)** | Corazón del Bosque, spikes, dusk warning, raids that escalate, wither/tend |
| B | Combat: roll, block/parry, bow with soft auto-aim, soft lock-on; generic enemy type |
| C | Death grave + co-op revive |
| D | Traversal spike: free climbing + stamina (fallback: marked surfaces), glider, swimming |
| E | Enredadera power + 3 open-world shrines |
| F | Instanced dungeon + drawing boss + purified defender |
| G | Land mount with timing-ring taming |
| H | El Marchito: Invasion 1 + visions |

Each later plan is written when its turn comes, against the code as it is then.

## Global Constraints

- All player-facing text in **Spanish**. The narrative voice is dry and short.
- **Phones first:** every new action needs a touch button (`src/client/touch.ts` `PILL_BUTTONS`) as well as a key.
- **Trust boundary:** every client message goes through `decodeClient` in `src/shared/protocol.ts`. The server validates range, cost and alive state for every action.
- **The world sleeps:** raids only happen while someone is online (the sim only steps while online).
- **Structures are never deleted by a withered Heart** (spec section 3). Only walls, campfires and spikes can be wrecked, and only by raid damage or wear.
- **Timing deviation from spec (recorded):** the spec says "~2 minute warning", but a full day is `DAY_LENGTH = 360 s`. The warning runs from `dayFraction 0.72` to night at `0.8`, about 29 s. It is the `RAID.warnAt` constant; retune after playtest.
- **Protocol:** `PROTOCOL_VERSION` goes 1 → 2 (stale clients get the "Hay una versión nueva" screen). `SavedWorld.version` stays `1`. New save fields are optional, and old saves load.
- Run `npm test`, `npm run test:workers` and `npm run check` before every commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Items, HP and protocol

**Files:**
- Modify: `src/shared/items.ts`
- Modify: `src/shared/protocol.ts`
- Modify: `src/shared/sim/wolves.ts` (the `raid` flag only)
- Modify: `test/workers/room.test.ts`, `test/workers/bots.test.ts`, `test/workers/helpers.ts` (any `v: 1` literal)
- Test: `src/shared/items.test.ts`, `src/shared/protocol.test.ts`

**Interfaces:**
- Produces:
  - `StructureKind = 'campfire' | 'wall' | 'heart' | 'spikes'`
  - `STRUCTURE_HP: Record<StructureKind, number>`, `TEND_COST: Inventory`, `TEND_HEAL: number`
  - `Structure.hp: number`
  - `WolfView.raid: boolean`
  - `RaidView = { phase: 'warn' | 'active'; dir: number; level: number }`
  - `HeartView = { id: number; hp: number; max: number }`
  - `snap` gains `raid: RaidView | null` and `heart: HeartView | null`
  - `ServerMsg` gains `{ t: 'hit'; id: number; hp: number }` and `{ t: 'wrecked'; id: number }`
  - `ClientMsg` gains `{ t: 'tend'; id: number }`
  - `Wolf.raid: boolean` (false from `createWolf`)

- [ ] **Step 1: Write failing tests**

Append to `src/shared/items.test.ts` (inside the existing top-level `describe`, or as a new `describe`):

```ts
import { BUILD_COST, STRUCTURE_HP, STRUCTURE_KINDS, TEND_COST } from './items';

describe('aventura structures', () => {
  it('every kind has a cost and HP', () => {
    for (const k of STRUCTURE_KINDS) {
      expect(BUILD_COST[k]).toBeDefined();
      expect(STRUCTURE_HP[k]).toBeGreaterThan(0);
    }
    expect(STRUCTURE_KINDS).toContain('heart');
    expect(STRUCTURE_KINDS).toContain('spikes');
    expect(TEND_COST).toEqual({ berries: 5 });
  });
});
```

Append to `src/shared/protocol.test.ts`:

```ts
import { decodeClient, PROTOCOL_VERSION } from './protocol';

describe('aventura protocol', () => {
  it('is version 2', () => {
    expect(PROTOCOL_VERSION).toBe(2);
  });
  it('decodes tend and rejects a bad id', () => {
    expect(decodeClient('{"t":"tend","id":3}')).toEqual({ t: 'tend', id: 3 });
    expect(decodeClient('{"t":"tend","id":-1}')).toBeNull();
    expect(decodeClient('{"t":"tend"}')).toBeNull();
  });
  it('accepts placing the new kinds', () => {
    expect(decodeClient('{"t":"place","kind":"heart","x":1,"z":2,"rot":0}')).toMatchObject({ kind: 'heart' });
    expect(decodeClient('{"t":"place","kind":"spikes","x":1,"z":2,"rot":0}')).toMatchObject({ kind: 'spikes' });
  });
});
```

(Merge imports with the file's existing imports if they already import from these modules.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/items.test.ts src/shared/protocol.test.ts`
Expected: FAIL (`STRUCTURE_HP` undefined, version is 1, `tend` decodes to null).

- [ ] **Step 3: Implement `items.ts`**

Replace the structure block in `src/shared/items.ts` with:

```ts
export type StructureKind = 'campfire' | 'wall' | 'heart' | 'spikes';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall', 'heart', 'spikes'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro', heart: 'Corazón del Bosque', spikes: 'Estacas' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
  heart: { wood: 20, stone: 10 },
  spikes: { wood: 3, stone: 1 },
};
export const STRUCTURE_HP: Record<StructureKind, number> = { campfire: 60, wall: 150, heart: 500, spikes: 80 };
/** Tending the Heart: berries in, HP back. */
export const TEND_COST: Inventory = { berries: 5 };
export const TEND_HEAL = 100;
```

- [ ] **Step 4: Implement `protocol.ts`**

In `src/shared/protocol.ts`:

```ts
export const PROTOCOL_VERSION = 2;
```

```ts
export interface WolfView { id: number; x: number; y: number; z: number; yaw: number; anim: WolfAnim; raid: boolean }
export interface Structure { id: number; kind: StructureKind; x: number; y: number; z: number; rot: number; owner: string; hp: number }
export interface RaidView { phase: 'warn' | 'active'; /** angle the raid comes from, around the Heart: x = sin, z = cos */ dir: number; level: number }
export interface HeartView { id: number; hp: number; max: number }
```

Add `| { t: 'tend'; id: number }` to `ClientMsg`. In `ServerMsg`, change the `snap` member and add two:

```ts
  | { t: 'snap'; time: number; players: PlayerView[]; wolves: WolfView[]; self: SelfState; raid: RaidView | null; heart: HeartView | null }
  | { t: 'hit'; id: number; hp: number }
  | { t: 'wrecked'; id: number }
```

In `decodeClient`, next to `case 'attack'`:

```ts
    case 'tend':
      return id(m.id) ? { t: 'tend', id: m.id } : null;
```

- [ ] **Step 5: Add the `raid` flag to `Wolf`**

In `src/shared/sim/wolves.ts`, add `raid: boolean;` to `interface Wolf` and `raid: false` to the object literal returned by `createWolf`.

- [ ] **Step 6: Fix compile fallout**

Run: `npm run check`. Fix each error by the minimal change:
- In `world-sim.ts` `onPlace`, add `hp: STRUCTURE_HP[kind]` to the new `Structure` (import `STRUCTURE_HP`), and add `heart: 'El Corazón del Bosque echó raíces', spikes: 'Estacas clavadas'` to `BUILT_TEXT`.
- In `snapshotFor`, map wolves with `raid: w.raid` and return `raid: null, heart: null` for now (Task 3 fills them).
- In `handle`, add `case 'tend': return;` for now (Task 2 fills it).
- In `src/client/scene/structures.ts` `add()`, a new kind falls through to `this.wall()` for now (Task 5 adds real meshes).
- In `test/workers/*`, replace every literal `v: 1` in hello messages with `v: PROTOCOL_VERSION` (import it from `../../src/shared/protocol`). Leave any test that sends a deliberately wrong version as is, but make sure its value is not 2.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run test:workers && npm run check`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(aventura): heart/spikes kinds, structure HP, tend + raid protocol v2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Heart placement, warmth and tending (sim)

**Files:**
- Modify: `src/shared/sim/world-sim.ts`
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: Task 1's types, `STRUCTURE_HP`, `TEND_COST`, `TEND_HEAL`
- Produces:
  - `export const HEART = { warmRadius: 8, tendReach: 4 } as const`
  - `WorldSim.heart(): Structure | undefined`
  - `WorldSim.raidLevel: number` (public, persisted)
  - `SavedWorld.raidLevel?: number`
  - private `say(text)` (broadcast toast) and `tell(name, text)`

- [ ] **Step 1: Write failing tests**

Append to `src/shared/sim/world-sim.test.ts` (reuses the file's `setup`, `put`, `msgs` helpers):

```ts
import { STRUCTURE_HP } from '../items';

function giveHeartMats(sim: WorldSim, name: string) {
  sim.getPlayer(name)!.inv = { wood: 40, stone: 20, berries: 20 };
}

function plantHeart(sim: WorldSim, name = 'Ana') {
  giveHeartMats(sim, name);
  const p = sim.getPlayer(name)!;
  sim.handle(name, { t: 'place', kind: 'heart', x: p.x + 2, z: p.z, rot: 0 });
  return sim.heart()!;
}

describe('Corazón del Bosque', () => {
  it('plants one heart per world with full HP', () => {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    expect(h.hp).toBe(STRUCTURE_HP.heart);
    giveHeartMats(sim, 'Leo');
    const l = sim.getPlayer('Leo')!;
    sim.handle('Leo', { t: 'place', kind: 'heart', x: l.x - 3, z: l.z + 3, rot: 0 });
    expect(sim.save().structures.filter((s) => s.kind === 'heart')).toHaveLength(1);
  });

  it('warms like a fire while alive', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    put(sim, 'Ana', h.x + 5, h.z);
    sim.time = DAY_LENGTH * 0.9; // night: without the Heart, warmth would drop
    sim.getPlayer('Ana')!.vitals.warmth = 10;
    for (let i = 0; i < 20; i++) sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.warmth).toBeGreaterThan(10);
  });

  it('tending costs 5 berries and heals, capped at max', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    h.hp = 50;
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(150);
    expect(sim.getPlayer('Ana')!.inv.berries).toBe(15);
    h.hp = STRUCTURE_HP.heart - 10;
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(STRUCTURE_HP.heart);
    expect(msgs(sim)).toContainEqual({ t: 'hit', id: h.id, hp: STRUCTURE_HP.heart });
  });

  it('refuses tending from too far or without berries', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    h.hp = 50;
    put(sim, 'Ana', h.x + 20, h.z);
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(50);
    put(sim, 'Ana', h.x + 1, h.z);
    sim.getPlayer('Ana')!.inv = {};
    sim.handle('Ana', { t: 'tend', id: h.id });
    expect(h.hp).toBe(50);
  });

  it('respawns at the heart when there is no own campfire', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    expect(sim.spawnFor('Ana')).toEqual({ x: h.x + 2, z: h.z });
  });

  it('loads old saves: missing hp and raidLevel get defaults', () => {
    const saved = newWorld(1, 's');
    saved.structures.push({ id: 1, kind: 'wall', x: 0, y: 0, z: 0, rot: 0, owner: 'Ana' } as never);
    const sim = new WorldSim(saved);
    expect(sim.save().structures[0]!.hp).toBe(STRUCTURE_HP.wall);
    expect(sim.raidLevel).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/sim/world-sim.test.ts`
Expected: FAIL (`sim.heart is not a function`).

- [ ] **Step 3: Implement**

In `src/shared/sim/world-sim.ts`:

1. Imports: add `STRUCTURE_HP, TEND_COST, TEND_HEAL` from `'../items'`.
2. Constants, after `HARVEST_COOLDOWN`:

```ts
export const HEART = { warmRadius: 8, tendReach: 4 } as const;
```

3. `SavedWorld`: add `raidLevel?: number;`. In `newWorld`, add `raidLevel: 0`.
4. Class fields: add `raidLevel: number;`. In the constructor, replace the structures line and set the level:

```ts
    this.structures = saved.structures.map((s) => ({ ...s, hp: s.hp ?? STRUCTURE_HP[s.kind] }));
    this.raidLevel = saved.raidLevel ?? 0;
```

5. `save()`: add `raidLevel: this.raidLevel,`.
6. Public helper next to `spawnFor`:

```ts
  heart(): Structure | undefined {
    return this.structures.find((s) => s.kind === 'heart');
  }
```

7. `spawnFor`: fall back to the Heart before the world spawn:

```ts
  spawnFor(name: string): { x: number; z: number } {
    const fire = [...this.structures].reverse().find((s) => s.kind === 'campfire' && s.owner === name);
    if (fire) return { x: fire.x + 1.5, z: fire.z };
    const h = this.heart();
    return h ? { x: h.x + 2, z: h.z } : { x: 0, z: 0 };
  }
```

8. `handle`: replace the placeholder with `case 'tend': return this.onTend(p, msg.id);`
9. `onPlace`: right after the materials check, add:

```ts
    if (kind === 'heart' && this.heart()) return toast('Ya hay un Corazón en este mundo');
```

10. New action, after `onEat`:

```ts
  private onTend(p: SavedPlayer, id: number): void {
    const h = this.heart();
    if (!h || h.id !== id || p.dead) return;
    if (Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    if (h.hp >= STRUCTURE_HP.heart) return this.tell(p.name, 'El Corazón está sano');
    if (!hasAll(p.inv, TEND_COST)) return this.tell(p.name, 'Necesitas 5 bayas');
    p.inv = removeAll(p.inv, TEND_COST);
    h.hp = Math.min(STRUCTURE_HP.heart, h.hp + TEND_HEAL);
    this.outbox.push({ to: null, msg: { t: 'hit', id: h.id, hp: h.hp } });
    this.tell(p.name, 'El Corazón late con más fuerza');
  }
```

11. Helpers section:

```ts
  private say(text: string): void {
    this.outbox.push({ to: null, msg: { t: 'toast', text } });
  }

  private tell(name: string, text: string): void {
    this.outbox.push({ to: name, msg: { t: 'toast', text } });
  }
```

12. `nearFire`: a living Heart warms (and scares ordinary wolves) within `HEART.warmRadius`:

```ts
  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    return this.structures.some((s) => {
      const d = Math.hypot(s.x - x, s.z - z);
      return (s.kind === 'campfire' && d < r) || (s.kind === 'heart' && s.hp > 0 && d < HEART.warmRadius);
    });
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(aventura): plant, warm and tend the Corazón del Bosque

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Raider AI (pure)

**Files:**
- Modify: `src/shared/sim/wolves.ts`
- Test: `src/shared/sim/wolves.test.ts`

**Interfaces:**
- Consumes: `Wolf`, `stepWolf`, `WolfTarget`, `WOLF`
- Produces:
  - `RAID` constants
  - `RaidGoal = { heartId: number; x: number; z: number; blockers: { id: number; x: number; z: number }[] }`
  - `RaidHit = { player: string } | { structure: number } | null`
  - `stepRaider(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): RaidHit`

- [ ] **Step 1: Write failing tests**

Append to `src/shared/sim/wolves.test.ts` (reuses `flat`, `rng`, `target`):

```ts
import { RAID, stepRaider, type RaidGoal } from './wolves';

const goal = (extra: Partial<RaidGoal> = {}): RaidGoal => ({ heartId: 99, x: 0, z: 0, blockers: [], ...extra });
const raider = (x: number, z = 0) => {
  const w = createWolf(1, x, z, flat, rng);
  w.raid = true;
  return w;
};

describe('raiders', () => {
  it('march to the heart when no player is near', () => {
    const w = raider(30);
    stepRaider(w, [target(-50)], goal(), flat, 0.1, rng);
    expect(w.x).toBeLessThan(30);
    expect(w.anim).toBe('run');
  });

  it('chew the heart in reach, with a cooldown', () => {
    const w = raider(1);
    expect(stepRaider(w, [], goal(), flat, 0.1, rng)).toEqual({ structure: 99 });
    expect(stepRaider(w, [], goal(), flat, 0.1, rng)).toBeNull();
    let hit = null;
    for (let i = 0; i < 20 && !hit; i++) hit = stepRaider(w, [], goal(), flat, 0.1, rng);
    expect(hit).toEqual({ structure: 99 });
  });

  it('stop and chew a wall in the way', () => {
    const w = raider(10);
    const g = goal({ blockers: [{ id: 7, x: 9, z: 0 }] });
    expect(stepRaider(w, [], g, flat, 0.1, rng)).toEqual({ structure: 7 });
    expect(w.x).toBe(10);
  });

  it('turn on a nearby player and ignore campfire fear', () => {
    const w = raider(10);
    const hit = stepRaider(w, [target(11, 0, { fires: true })], goal(), flat, 0.1, rng);
    expect(w.target).toBe('Ana');
    expect(hit).toEqual({ player: 'Ana' });
  });

  it('ignore players beyond aggro range', () => {
    const w = raider(10);
    stepRaider(w, [target(10 + RAID.aggro + 5)], goal(), flat, 0.1, rng);
    expect(w.target).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/sim/wolves.test.ts`
Expected: FAIL (`stepRaider` not exported).

- [ ] **Step 3: Implement**

Append to `src/shared/sim/wolves.ts`:

```ts
export const RAID = {
  /** Warning starts at this day fraction; night (the attack) starts at 0.8. */
  warnAt: 0.72,
  base: 4,
  perLevel: 2,
  perPlayer: 2,
  maxWave: 20,
  spawnMin: 45,
  spawnMax: 60,
  aggro: 10,
  structReach: 2.2,
  heartReach: 2.6,
  damage: 12,
  cooldown: 1.2,
} as const;

export interface RaidGoal {
  heartId: number;
  x: number;
  z: number;
  /** Wall sample points (3 per wall) that stop the march. */
  blockers: { id: number; x: number; z: number }[];
}

export type RaidHit = { player: string } | { structure: number } | null;

/** Corrupted raider: not scared of fire, fights players who come close, otherwise marches on the Heart and chews what blocks it. */
export function stepRaider(w: Wolf, targets: WolfTarget[], goal: RaidGoal, terrain: Terrain, dt: number, rng: () => number): RaidHit {
  if (w.hp <= 0) {
    stepWolf(w, [], terrain, dt, rng);
    return null;
  }
  const near = targets
    .filter((t) => !t.dead && Math.hypot(t.x - w.x, t.z - w.z) < RAID.aggro)
    .map((t) => ({ ...t, fires: false }));
  if (near.length) {
    const bit = stepWolf(w, near, terrain, dt, rng);
    return bit ? { player: bit } : null;
  }
  w.target = null;
  w.cooldown = Math.max(0, w.cooldown - dt);
  const dx = goal.x - w.x;
  const dz = goal.z - w.z;
  const d = Math.max(Math.hypot(dx, dz), 1e-4);
  w.yaw = Math.atan2(dx / d, dz / d);
  const victim = d < RAID.heartReach ? goal.heartId : goal.blockers.find((b) => Math.hypot(b.x - w.x, b.z - w.z) < RAID.structReach)?.id;
  if (victim !== undefined) {
    w.anim = 'attack';
    if (w.cooldown > 0) return null;
    w.cooldown = RAID.cooldown;
    return { structure: victim };
  }
  const nx = w.x + (dx / d) * WOLF.run * dt;
  const nz = w.z + (dz / d) * WOLF.run * dt;
  if (terrain.heightAt(nx, nz) >= WATER_LEVEL) {
    w.x = nx;
    w.z = nz;
  } else {
    // ponytail: sidestep water by walking perpendicular; real pathfinding if raiders get stuck in playtest
    w.x += (dz / d) * WOLF.run * dt;
    w.z -= (dx / d) * WOLF.run * dt;
  }
  w.y = terrain.heightAt(w.x, w.z);
  w.anim = 'run';
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared/sim/wolves.test.ts && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(aventura): raider AI marches on the Heart and chews walls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Raid lifecycle in the sim

**Files:**
- Modify: `src/shared/sim/world-sim.ts`
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: `RAID`, `RaidGoal`, `stepRaider` (Task 3); `heart()`, `say()`, `HEART` (Task 2)
- Produces:
  - `export const SPIKES = { radius: 1.3, dps: 25, wear: 4 } as const`
  - `WorldSim.raidState(): { phase: 'warn' | 'active'; dir: number } | null`
  - `snap.raid` and `snap.heart` filled

- [ ] **Step 1: Write failing tests**

Append to `src/shared/sim/world-sim.test.ts`:

```ts
import { RAID } from './wolves';
import { SPIKES } from './world-sim';

/** Step the clock until dayFraction reaches f (wrapping through midnight if needed). */
function stepTo(sim: WorldSim, f: number) {
  const target = f * DAY_LENGTH;
  let guard = 0;
  while (Math.abs((sim.time % DAY_LENGTH) - target) > 0.06 && guard++ < DAY_LENGTH * 10 + 10) sim.step(0.1);
}

describe('asedios', () => {
  it('no raid without a heart', () => {
    const sim = setup('Ana');
    stepTo(sim, 0.85);
    expect(sim.raidState()).toBeNull();
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
  });

  it('warns at dusk, attacks at night, levels up at dawn', () => {
    const sim = setup('Ana');
    plantHeart(sim);
    stepTo(sim, RAID.warnAt + 0.01);
    expect(sim.raidState()?.phase).toBe('warn');
    expect(snap(sim, 'Ana').raid).toMatchObject({ phase: 'warn', level: 0 });
    stepTo(sim, 0.81);
    expect(sim.raidState()?.phase).toBe('active');
    expect(sim.wolfList.filter((w) => w.raid).length).toBe(RAID.base);
    put(sim, 'Ana', 150, 150); // out of the way so raiders ignore Ana
    sim.heart()!.hp = 100_000; // survives any chewing
    stepTo(sim, 0.3);
    expect(sim.raidState()).toBeNull();
    expect(sim.raidLevel).toBe(1);
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
  });

  it('bigger waves with level and players', () => {
    const sim = setup('Ana', 'Leo');
    plantHeart(sim);
    sim.raidLevel = 2;
    stepTo(sim, 0.81);
    expect(sim.wolfList.filter((w) => w.raid).length).toBe(RAID.base + RAID.perLevel * 2 + RAID.perPlayer);
  });

  it('raiders chew walls until they are wrecked', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    const w = sim.wolfList.find((x) => x.raid)!;
    const wall = { id: 500, kind: 'wall' as const, x: w.x, y: 0, z: w.z, rot: 0, owner: 'Ana', hp: RAID.damage };
    (sim as unknown as { structures: unknown[] }).structures.push(wall);
    put(sim, 'Ana', h.x + 150, h.z + 150);
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(msgs(sim)).toContainEqual({ t: 'wrecked', id: 500 });
    expect(sim.save().structures.some((s) => s.id === 500)).toBe(false);
  });

  it('a heart at 0 withers: raid ends, raiders leave, no level up, heart stays', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    for (const w of sim.wolfList) if (w.raid) Object.assign(w, { x: h.x + 1, z: h.z });
    h.hp = 1;
    put(sim, 'Ana', h.x + 150, h.z + 150);
    for (let i = 0; i < 5; i++) sim.step(0.1);
    expect(h.hp).toBe(0);
    expect(sim.raidState()).toBeNull();
    expect(sim.wolfList.some((w) => w.raid)).toBe(false);
    expect(sim.heart()).toBeDefined();
    stepTo(sim, 0.3);
    expect(sim.raidLevel).toBe(0);
  });

  it('a withered heart never warns', () => {
    const sim = setup('Ana');
    plantHeart(sim).hp = 0;
    stepTo(sim, 0.78);
    expect(sim.raidState()).toBeNull();
  });

  it('spikes hurt wolves standing on them and wear out', () => {
    const sim = setup('Ana');
    const h = plantHeart(sim);
    stepTo(sim, 0.81);
    const w = sim.wolfList.find((x) => x.raid)!;
    const sp = { id: 600, kind: 'spikes' as const, x: w.x, y: 0, z: w.z, rot: 0, owner: 'Ana', hp: 1 };
    (sim as unknown as { structures: unknown[] }).structures.push(sp);
    const hp0 = w.hp;
    put(sim, 'Ana', h.x + 150, h.z + 150);
    sim.step(0.1);
    expect(w.hp).toBeLessThan(hp0);
    for (let i = 0; i < 5; i++) sim.step(0.1);
    expect(sim.save().structures.some((s) => s.id === 600)).toBe(false);
    expect(SPIKES.dps).toBeGreaterThan(0);
  });

  it('snap carries the heart for everyone, even far away', () => {
    const sim = setup('Ana', 'Leo');
    const h = plantHeart(sim);
    put(sim, 'Leo', h.x + 180, h.z);
    expect(snap(sim, 'Leo').heart).toEqual({ id: h.id, hp: h.hp, max: 500 });
  });

  it('raid level survives save/load', () => {
    const sim = setup('Ana');
    sim.raidLevel = 3;
    expect(new WorldSim(sim.save()).raidLevel).toBe(3);
  });
});
```

Note: `setup` connects players at world time `DAY_LENGTH * 0.33`, so `stepTo` moves forward through the day.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/sim/world-sim.test.ts`
Expected: FAIL (`raidState` not a function).

- [ ] **Step 3: Implement**

In `src/shared/sim/world-sim.ts`:

1. Import `RAID, stepRaider, type RaidGoal` from `'./wolves'`.
2. Constant after `HEART`:

```ts
export const SPIKES = { radius: 1.3, dps: 25, wear: 4 } as const;
```

3. Field: `private raid: { phase: 'warn' | 'active'; dir: number } | null = null;` Public accessor:

```ts
  raidState(): { phase: 'warn' | 'active'; dir: number } | null {
    return this.raid;
  }
```

4. In `step()`, replace everything from `if (night && !this.wasNight) this.spawnWolves();` to the end of the method with:

```ts
    this.stepRaid(night);
    if (night && !this.wasNight) this.spawnWolves();
    if (!night && this.wasNight) this.wolves = [];
    this.wasNight = night;

    const targets = this.targets();
    const goal = this.raidGoal();
    for (const w of this.wolves) {
      if (w.raid) {
        if (!goal) continue;
        const hit = stepRaider(w, targets, goal, this.terrain, dt, this.rng);
        if (hit && 'player' in hit) this.bite(hit.player, RAID.damage);
        else if (hit) this.damageStructure(hit.structure, RAID.damage);
        continue;
      }
      const bit = stepWolf(w, targets, this.terrain, dt, this.rng);
      if (bit) this.bite(bit, WOLF.damage);
    }
    this.stepSpikes(dt);
    this.wolves = this.wolves.filter((w) => w.deadFor < WOLF.corpseTime);
  }
```

5. New private methods in the helpers section:

```ts
  private stepRaid(night: boolean): void {
    const heart = this.heart();
    const f = dayFraction(this.time);
    if (!this.raid && heart && heart.hp > 0 && !night && f >= RAID.warnAt && this.activeCount() > 0) {
      this.raid = { phase: 'warn', dir: this.rng() * Math.PI * 2 };
      this.say('El cielo se tiñe de morado. El Marchito envía a sus bestias: vuelvan al Corazón');
    }
    if (night && !this.wasNight && this.raid?.phase === 'warn' && heart) {
      this.raid.phase = 'active';
      this.spawnRaiders(heart, this.raid.dir);
    }
    if (!night && this.wasNight && this.raid) {
      this.raid = null;
      if (heart && heart.hp > 0) {
        this.raidLevel++;
        this.say(`Sobrevivieron la noche. Nivel de asedio ${this.raidLevel}`);
      }
    }
  }

  private spawnRaiders(heart: Structure, dir: number): void {
    const extra = Math.max(0, this.activeCount() - 1);
    const n = Math.min(RAID.maxWave, RAID.base + RAID.perLevel * this.raidLevel + RAID.perPlayer * extra);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const ang = dir + (this.rng() - 0.5) * 0.8;
        const d = RAID.spawnMin + this.rng() * (RAID.spawnMax - RAID.spawnMin);
        const x = heart.x + Math.sin(ang) * d;
        const z = heart.z + Math.cos(ang) * d;
        if (Math.abs(x) < HALF - 5 && Math.abs(z) < HALF - 5 && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng);
          w.raid = true;
          this.wolves.push(w);
          break;
        }
      }
    }
  }

  private raidGoal(): RaidGoal | null {
    const h = this.heart();
    if (!h || this.raid?.phase !== 'active') return null;
    const blockers = this.structures
      .filter((s) => s.kind === 'wall')
      .flatMap((s) => [-1, 0, 1].map((o) => ({ id: s.id, x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o })));
    return { heartId: h.id, x: h.x, z: h.z, blockers };
  }

  private damageStructure(id: number, dmg: number): void {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return;
    s.hp = Math.max(0, s.hp - dmg);
    if (s.kind !== 'heart' && s.hp === 0) return this.wreck(s);
    this.outbox.push({ to: null, msg: { t: 'hit', id, hp: Math.round(s.hp) } });
    if (s.kind === 'heart' && s.hp === 0) {
      this.say('El Corazón del Bosque se marchitó. Cuídenlo con bayas');
      this.raid = null;
      this.wolves = this.wolves.filter((w) => !w.raid);
    }
  }

  private wreck(s: Structure): void {
    this.structures.splice(this.structures.indexOf(s), 1);
    this.outbox.push({ to: null, msg: { t: 'wrecked', id: s.id } });
  }

  private stepSpikes(dt: number): void {
    for (const s of this.structures.filter((x) => x.kind === 'spikes')) {
      for (const w of this.wolves) {
        if (w.hp <= 0 || Math.hypot(w.x - s.x, w.z - s.z) > SPIKES.radius) continue;
        hitWolf(w, SPIKES.dps * dt);
        s.hp -= SPIKES.wear * dt;
      }
      if (s.hp <= 0) this.wreck(s);
    }
  }

  private bite(name: string, dmg: number): void {
    const p = this.players.get(name);
    if (!p) return;
    p.vitals = damage(p.vitals, dmg);
    if (p.vitals.health <= 0) this.kill(p);
  }
```

6. `snapshotFor`: replace the `raid: null, heart: null` placeholders:

```ts
    const h = this.heart();
    const raid = this.raid ? { phase: this.raid.phase, dir: r2(this.raid.dir), level: this.raidLevel } : null;
    const heart = h ? { id: h.id, hp: Math.round(h.hp), max: STRUCTURE_HP.heart } : null;
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l), raid, heart };
```

7. The `WelcomeMsg.structures` copy already carries `hp`. Nothing to do.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run test:workers && npm run check`
Expected: PASS. If the "warns at dusk" test sees fewer raiders than `RAID.base`, spawn points fell in water for seed 42: move the planted Heart inland in `plantHeart` (for example `put(sim, name, 20, 20)` first) rather than weakening the assertion.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(aventura): dusk warning, night raids on the Heart, spikes, wither, siege level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client — meshes, HUD, raid banner, sky tint, controls

**Files:**
- Create: `src/client/raid-ui.ts`, `src/client/raid-ui.test.ts`
- Modify: `src/client/scene/structures.ts`, `src/client/hud.ts`, `src/client/scene/sky.ts`, `src/client/input.ts`, `src/client/touch.ts`, `src/client/game.ts`, `src/client/style.css`

**Interfaces:**
- Consumes: `RaidView`, `HeartView`, `hit` and `wrecked` messages, `tend` (Tasks 1–4); `HEART.tendReach` (Task 2)
- Produces:
  - `raidText(raid: RaidView | null, camYaw: number): string | null`
  - `StructureMeshes.remove(id)`, `StructureMeshes.setHp(id, hp)`
  - `Hud.setHeart(h: HeartView | null)`, `Hud.setRaid(text: string | null)`
  - `DayLight.update(f, focus, raid = 0)`

- [ ] **Step 1: Write the failing test for the only pure piece**

`src/client/raid-ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { raidArrow, raidText } from './raid-ui';

describe('raid ui', () => {
  // Camera yaw 0 looks toward -Z. A raid "dir" is the angle of its origin around the Heart (x = sin, z = cos).
  it('ahead is up, right is right, behind is down', () => {
    expect(raidArrow(Math.PI, 0)).toBe('⬆️');
    expect(raidArrow(Math.PI / 2, 0)).toBe('➡️');
    expect(raidArrow(0, 0)).toBe('⬇️');
    expect(raidArrow(-Math.PI / 2, 0)).toBe('⬅️');
  });
  it('texts per phase', () => {
    expect(raidText(null, 0)).toBeNull();
    expect(raidText({ phase: 'warn', dir: Math.PI, level: 0 }, 0)).toBe('⬆️ Se acerca un asedio');
    expect(raidText({ phase: 'active', dir: Math.PI, level: 2 }, 0)).toBe('⬆️ ¡Asedio! Nivel 2');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/client/raid-ui.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `raid-ui.ts`**

```ts
import type { RaidView } from '../shared/protocol';

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

/** Screen arrow toward the raid origin. Camera forward is angle yaw + π in the x=sin/z=cos convention; screen-right is forward − π/2. */
export function raidArrow(dir: number, camYaw: number): string {
  const rel = dir - (camYaw + Math.PI);
  const k = Math.round(-rel / (Math.PI / 4));
  return ARROWS[((k % 8) + 8) % 8]!;
}

export function raidText(raid: RaidView | null, camYaw: number): string | null {
  if (!raid) return null;
  const arrow = raidArrow(raid.dir, camYaw);
  return raid.phase === 'warn' ? `${arrow} Se acerca un asedio` : `${arrow} ¡Asedio! Nivel ${raid.level}`;
}
```

Run: `npx vitest run src/client/raid-ui.test.ts`. Expected: PASS.

- [ ] **Step 4: Meshes in `structures.ts`**

Add materials at the top:

```ts
const HEART_LEAF = new THREE.MeshLambertMaterial({ color: 0x3fbf6a, emissive: 0x1f7a3a, emissiveIntensity: 0.6 });
const WITHERED = new THREE.MeshLambertMaterial({ color: 0x5a5048 });
const SPIKE = new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true });
```

Replace `add()`:

```ts
  add(s: Structure): Circle[] {
    const obj = s.kind === 'campfire' ? this.campfire(s) : s.kind === 'heart' ? this.heart() : s.kind === 'spikes' ? this.spikes() : this.wall();
    obj.position.set(s.x, s.y, s.z);
    obj.rotation.y = s.rot;
    this.group.add(obj);
    this.byId.set(s.id, obj);
    if (s.kind === 'heart') this.setHp(s.id, s.hp);
    if (s.kind === 'campfire') return [{ x: s.x, z: s.z, r: 0.6 }];
    if (s.kind === 'heart') return [{ x: s.x, z: s.z, r: 1.2 }];
    if (s.kind === 'spikes') return []; // players walk over them
    // A 3 m wall along its local X axis, approximated by three circles.
    return [-1, 0, 1].map((o) => ({ x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o, r: 0.55 }));
  }

  remove(id: number): void {
    this.byId.get(id)?.removeFromParent();
    this.byId.delete(id);
  }

  /** Heart only: the crown turns grey when withered. */
  setHp(id: number, hp: number): void {
    const crown = this.byId.get(id)?.getObjectByName('crown') as THREE.Mesh | undefined;
    if (crown) crown.material = hp > 0 ? HEART_LEAF : WITHERED;
  }
```

Add builders next to `wall()`:

```ts
  private heart(): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 8), WOOD);
    trunk.position.y = 1.2;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), HEART_LEAF);
    crown.name = 'crown';
    crown.position.y = 3;
    trunk.castShadow = crown.castShadow = true;
    const glow = new THREE.PointLight(0x7dffb0, 12, 12, 1.6);
    glow.position.y = 2.5;
    g.add(trunk, crown, glow);
    return g;
  }

  private spikes(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 5), SPIKE);
      c.position.set((i - 2) * 0.3, 0.3, (i % 2) * 0.25 - 0.12);
      c.rotation.x = -0.35;
      g.add(c);
    }
    return g;
  }
```

- [ ] **Step 5: HUD (`hud.ts`) and CSS**

Fields:

```ts
  private readonly heartRow = el('div', 'stat');
  private readonly raidLine = el('div', 'raid-line');
```

In the constructor, after the vitals loop:

```ts
    this.heartRow.innerHTML = '<span>🌳</span><div class="bar"><i style="background:#5fd38a"></i></div><span class="val"></span>';
    this.heartRow.hidden = true;
    stats.appendChild(this.heartRow);
    this.raidLine.hidden = true;
```

Change the `append` line to include `this.raidLine`:

```ts
    this.root.append(stats, this.inv, this.log, this.banner, this.prompt, this.raidLine);
```

Methods:

```ts
  setHeart(h: { hp: number; max: number } | null): void {
    this.heartRow.hidden = !h;
    if (!h) return;
    (this.heartRow.querySelector('i') as HTMLElement).style.width = `${(h.hp / h.max) * 100}%`;
    (this.heartRow.querySelector('.val') as HTMLElement).textContent = h.hp > 0 ? String(h.hp) : 'marchito';
    this.heartRow.classList.toggle('low', h.hp < h.max * 0.25);
  }

  setRaid(text: string | null): void {
    this.raidLine.hidden = !text;
    if (text) this.raidLine.textContent = text;
  }
```

Append to `src/client/style.css`:

```css
.raid-line { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 6px 14px; border-radius: 999px; background: rgba(70, 20, 90, 0.85); color: #f3e6ff; font-weight: 700; pointer-events: none; white-space: nowrap; }
.raid-line[hidden], .stat[hidden] { display: none; }
```

- [ ] **Step 6: Sky tint (`sky.ts`)**

Add `const RAID_SKY = new THREE.Color(0x4a1f5c);`. Change the signature to `update(f: number, focus: THREE.Vector3, raid = 0): void` and right after the `this.bg.copy(...)` line add:

```ts
    if (raid > 0) this.bg.lerp(RAID_SKY, raid);
```

- [ ] **Step 7: Controls (`input.ts`, `touch.ts`)**

`input.ts`: extend `Action` with `| 'heart' | 'spikes'`, and add `KeyG: 'heart', KeyT: 'spikes'` to `KEY_ACTIONS`.

`touch.ts` `PILL_BUTTONS`, after the wall pill:

```ts
  { code: 'KeyG', label: '🌳', sub: 'corazón', cls: 'pill' },
  { code: 'KeyT', label: '🗡️', sub: 'estacas', cls: 'pill' },
```

- [ ] **Step 8: Wire `game.ts`**

1. Imports: `raidText` from `'./raid-ui'`; `HEART` alongside `PUNCH, REACH` from `'../shared/sim/world-sim'`; `type HeartView, type RaidView` from `'../shared/protocol'`.
2. Fields: `private heart: HeartView | null = null;` and `private raid: RaidView | null = null;`
3. `onMsg`: add cases:

```ts
      case 'hit':
        if (this.heart?.id === m.id) this.heart = { ...this.heart, hp: m.hp };
        this.structures.setHp(m.id, m.hp);
        return;
      case 'wrecked':
        this.structures.remove(m.id);
        for (let i = 0; i < 3; i++) this.colliders.remove(`s${m.id}:${i}`);
        return;
```

4. `onSnap`: at the top, after `this.applySelf(m.self);`:

```ts
    this.raid = m.raid;
    this.heart = m.heart;
    this.hud.setHeart(m.heart);
    if (m.heart) this.structures.setHp(m.heart.id, m.heart.hp);
```

In the wolves loop, after creating or getting `r`, add `r.actor.root.scale.setScalar(w.raid ? 1.3 : 1);` (raiders read as bigger beasts).

5. `onAction`: change the build line to:

```ts
    if (a === 'campfire' || a === 'wall' || a === 'heart' || a === 'spikes') return this.place(a);
```

6. `act()`: before the resource fallback (`const res = this.nearestResource();`) add:

```ts
    if (this.canTend()) return this.conn.send({ t: 'tend', id: this.heart!.id });
```

And add the helper:

```ts
  private canTend(): boolean {
    const h = this.heart;
    const s = h && this.structures.position(h.id);
    return !!h && !!s && h.hp < h.max && Math.hypot(s.x - this.body!.x, s.z - this.body!.z) <= HEART.tendReach;
  }
```

With this in `structures.ts`:

```ts
  position(id: number): THREE.Vector3 | null {
    return this.byId.get(id)?.position ?? null;
  }
```

7. `updatePrompt`: before the resource prompt:

```ts
    if (this.body && this.canTend()) return this.hud.setPrompt('E · Cuidar el Corazón (5 bayas)');
```

8. `frame()`: change the light update and set the banner:

```ts
    this.light.update(dayFraction(this.serverTime), focus, this.raid ? (this.raid.phase === 'active' ? 0.55 : 0.3) : 0);
    this.hud.setRaid(raidText(this.raid, this.rig.yaw));
```

- [ ] **Step 9: Run tests and type-check**

Run: `npm test && npm run test:workers && npm run check && npm run build`
Expected: PASS, and the build succeeds.

- [ ] **Step 10: Local browser check**

Start the local server with `npm run dev:server` (via the preview tool or a background terminal), then open `http://localhost:8787`. Create the local world the way the README says for local dev. Then check:
- G plants the Heart. The 🌳 bar appears.
- Standing near the Heart warms you.
- T places spikes. The touch pills show 🌳 and 🗡️ in mobile emulation.
- Wait for dusk. You can temporarily set `DAY_LENGTH` low locally, but **do not commit that**. At dusk: the purple sky, the banner arrow pointing to where the raiders appear, bigger foxes marching on the Heart, walls disappearing when chewed, spikes killing raiders.
- Let the Heart hit 0: the crown goes grey, "marchito" shows, and E with 5 berries heals it.

If the banner arrow points the wrong way, flip the sign of `rel` in `raidArrow` and update its test. Take a screenshot of a raid for the report.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(aventura): heart/spikes meshes, heart bar, raid banner + purple sky, controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ship to the test world

**Files:** none (deploy + verification)

- [ ] **Step 1:** Push the branch and open a PR to `main` with a playtest checklist (the Task 5 Step 10 bullets).
- [ ] **Step 2:** After CI is green and Gabriel OKs the merge, the deploy workflow ships. Verify on `https://bosque.juegodk.workers.dev` in world `test`: join from a PC and a mobile-emulated tab, plant a Heart, and survive one raid. Report the rollback path (revert the merge commit and redeploy).
- [ ] **Step 3:** Record the playtest findings (warning length, wave size, Heart HP) in `docs/superpowers/2026-09-26-foundation-followups.md` or a new aventura follow-ups file, for tuning in Plan B.

---

## Self-review notes

- **Spec coverage (Slice 1, base part):**
  - Heart (§3): Tasks 2, 4 and 5.
  - Wither without deleting structures (§3): Task 4 (the heart is never wrecked; walls are wrecked by raiders only).
  - Corruption per direction (§3): deferred. There is only one biome in Slice 1, so "direction" is just the raid origin; per-zone corruption arrives with Plan E/H, when purification exists.
  - Dusk warning (§4): Task 4 plus the banner in Task 5.
  - Escalating raids (§3/§12): `raidLevel` plus players online.
  - Traps (§12, "2–3"): **spikes only** in Plan A. Heart warmth and walls cover defense for now. Fire traps come with the Luz/Fuego power; a second trap gets added if the playtest asks for it.
  - Purified defenders defending alone: Plan F.
- **Types:** `Structure.hp`, `RaidView`, `HeartView`, `RaidGoal`, `RaidHit`, `stepRaider`, `heart()`, `raidState()` and `raidLevel` are used consistently across Tasks 1–5.
