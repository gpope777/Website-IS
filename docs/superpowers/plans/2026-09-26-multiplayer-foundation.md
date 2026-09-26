# Bosque Online — Sub-project #1: Multiplayer Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-player Bosque with a private, always-on 3-player online world (third-person, gathering, campfire/wall building, night wolves) served entirely from one Cloudflare Worker + Durable Object.

**Architecture:** Pure, tested game rules in `src/shared/` (terrain, resources, items, vitals, protocol, `WorldSim`, wolf AI) run on the server inside a `WorldRoom` Durable Object that owns state, ticks at 10 Hz, and persists one JSON row in DO SQLite. The Three.js client in `src/client/` regenerates terrain from the seed, predicts its own movement, interpolates everyone else, and talks JSON over one WebSocket. One `wrangler deploy` ships client assets + server together.

**Tech Stack:** TypeScript (strict), Three.js 0.185, Vite 8, Vitest 4.1, Wrangler 4, `@cloudflare/vitest-plugin`, Cloudflare Workers Static Assets + SQLite Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-online-design.md`

## Global Constraints

- All player-facing text in **Spanish**.
- Co-op only: players never damage players.
- Max 8 online players per world; world code matches `^[a-z0-9-]{3,32}$`; name matches `^[\p{L}\p{N} _-]{1,16}$` (u flag); PIN is exactly 4 digits.
- Server tick 10 Hz (`TICK_DT = 0.1`); client sends `move` at most 10 Hz; snapshots filtered to 100 m (`VIEW_RADIUS`).
- Terrain is never sent over the network; only seed + deltas (depleted resource ids, structures).
- World clock advances only while the room loop runs (someone online or within 30 s away timeout). No raids/damage to offline players.
- Death keeps inventory (penalties come in sub-projects #3/#4).
- Server validates every action; client input is untrusted.
- Free-tier budget (verified 2026-09-26): DO requests 100k/day (incoming WS messages billed 20:1), 13,000 GB-s/day duration, 100k SQLite rows written/day, SQLite-backed DOs only. Our design: ~1.5 billed req/s with 3 players, 1 row write per 5 s.
- `@cloudflare/vitest-plugin` requires **vitest ^4.1** (the repo currently has vitest 5 — downgrade in Task 1).
- Yaw convention everywhere in protocol/sim: `yaw = atan2(dirX, dirZ)`; a model facing +Z rotated by `yaw` faces the movement direction.
- Do not push to `main` or deploy without Gabriel's OK (Task 15 lists what needs him).

## Deviations from spec (deliberate, simpler)

- Persistence is **one JSON row** (`kv` table, key `world`) instead of normalized tables. Ceiling: SQLite row limit 2 MB; the world blob is ~50 KB at 500 structures. Split when #3 adds large bases.
- No separate `test` Cloudflare environment: development uses local `wrangler dev` (local storage, never touches production), and device playtests use a production world code `test`, separate Durable Object from the family world. Spec's intent (dev never touches family world) holds.
- No player "hit" animation: the stand-in robot model has no hit clip. Damage shows through the health bar; real reactions come with custom characters in #4.
- Reconciliation is "server accepts or snaps back" (`self.fix`), not sequence-numbered replay. Enough for co-op.

## File Map

```
src/shared/            (pure TS, no DOM, no three) — runs on client AND server
  rng.ts noise.ts      moved from src/game/
  terrain.ts           createTerrain(seed) → heightAt/density; WORLD_SIZE, HALF, WATER_LEVEL
  resources.ts         generateResources(terrain, seed) → ResourceSpawn[] (id = index); HARVEST
  items.ts             ItemId, Inventory, StructureKind, BUILD_COST, inventory ops
  survival.ts          Vitals, tickVitals, eatBerry, damage
  protocol.ts          PROTOCOL_VERSION, ClientMsg/ServerMsg, decodeClient (validation), r2
  sim/wolves.ts        Wolf AI step (pure)
  sim/world-sim.ts     WorldSim: authoritative state machine + save/load
src/server/
  auth.ts              hashPin, RateLimiter
  world-room.ts        WorldRoom Durable Object (sockets, loop, persistence, admin)
  index.ts             Worker router (/ws/:world, /admin/:world/*, assets)
  tsconfig.json
src/client/
  main.ts join.ts game.ts hud.ts input.ts touch.ts style.css
  net.ts interp.ts movement.ts colliders.ts quality.ts camera-rig.ts
  scene/terrain-mesh.ts scene/vegetation.ts scene/sky.ts scene/structures.ts
  actors/models.ts actors/actor.ts
test/workers/          Workers-runtime integration tests (room + 3-bot test)
public/models/         robot.glb, fox.glb, CREDITS.md
wrangler.jsonc  vitest.config.ts  vitest.workers.config.ts  worker-configuration.d.ts
```

Old `src/game/`, `src/ui/`, `src/main.ts` are deleted in Task 14 (git history keeps them; relics/lore/creatures return in sub-project #5).

---

### Task 1: Tooling and shared folder

**Files:**
- Move: `src/game/rng.ts` → `src/shared/rng.ts`, `src/game/noise.ts` → `src/shared/noise.ts`
- Modify: `src/game/creatures.ts:4`, `src/game/game.ts:3`, `src/game/wolves.ts:4`, `src/game/world.ts:2-3` (import paths)
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `src/shared/rng.ts` (`createRng(seed): () => number`, `hashSeed(text): number`), `src/shared/noise.ts` (`class Noise2D { value(x,y); fbm(x,y,octaves?,lacunarity?,gain?) }`) — unchanged code, new location.

- [ ] **Step 1: Move files and fix imports**

```bash
cd ~/Website-IS
mkdir -p src/shared
git mv src/game/rng.ts src/shared/rng.ts
git mv src/game/noise.ts src/shared/noise.ts
sed -i "s#from './rng'#from '../shared/rng'#" src/game/creatures.ts src/game/game.ts src/game/wolves.ts src/game/world.ts
sed -i "s#from './noise'#from '../shared/noise'#" src/game/world.ts
```
`src/shared/noise.ts` imports `./rng`, which still resolves (both moved together).

- [ ] **Step 2: Swap test tooling**

```bash
npm i -D vitest@^4.1.0 @cloudflare/vitest-plugin wrangler@^4
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

Replace `vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: { target: 'es2022' },
  // In dev, the client runs on Vite (5173) and the world server on `wrangler dev` (8787).
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
      '/admin': 'http://127.0.0.1:8787',
    },
  },
});
```

In `tsconfig.json` add after `"include": ["src"]`:
```json
  "exclude": ["src/server"]
```

In `package.json` replace `"scripts"` with:
```json
  "scripts": {
    "dev": "vite",
    "dev:server": "vite build && wrangler dev --port 8787",
    "build": "vite build",
    "check": "tsc --noEmit && tsc --noEmit -p src/server && tsc --noEmit -p test/workers",
    "test": "vitest run",
    "test:workers": "vitest run -c vitest.workers.config.ts",
    "test:watch": "vitest",
    "deploy": "npm run build && wrangler deploy"
  },
```
(`check` references `src/server` and `test/workers`, which exist from Task 8. Until then run `npx tsc --noEmit` alone.)

Append to `.gitignore`:
```
.wrangler/
.dev.vars
```

- [ ] **Step 3: Verify nothing broke**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: typecheck clean; existing `player.test.ts` and `survival.test.ts` PASS; build writes `dist/`.

- [ ] **Step 4: Commit**

```bash
git add -A src package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json .gitignore
git commit -m "chore: shared folder, vitest 4.1, wrangler tooling"
```

---

### Task 2: Shared terrain and resource placement

**Files:**
- Create: `src/shared/terrain.ts`, `src/shared/resources.ts`
- Test: `src/shared/worldgen.test.ts`

**Interfaces:**
- Consumes: `Noise2D`, `createRng` (Task 1); `ItemId` from `src/shared/items.ts` (type-only; Task 3 creates it — create `items.ts` in this task with just `export type ItemId = 'wood' | 'stone' | 'berries';` and Task 3 extends it).
- Produces:
  - `WORLD_SIZE = 480`, `HALF = 240`, `WATER_LEVEL = -3.2`
  - `interface Terrain { heightAt(x: number, z: number): number; density(x: number, z: number): number }`
  - `createTerrain(seed: number): Terrain`
  - `type ResourceKind = 'tree' | 'rock' | 'bush'`
  - `interface ResourceSpawn { id: number; kind: ResourceKind; x: number; y: number; z: number; scale: number; rot: number; radius: number }`
  - `HARVEST: Record<ResourceKind, { item: ItemId; amount: number; uses: number; regrow: number; label: string }>`
  - `SPAWN_CLEAR = 9`, `generateResources(terrain: Terrain, seed: number): ResourceSpawn[]` (id === array index)

- [ ] **Step 1: Write the failing test** — `src/shared/worldgen.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateResources, SPAWN_CLEAR } from './resources';

describe('terrain', () => {
  it('is deterministic per seed', () => {
    const a = createTerrain(42);
    const b = createTerrain(42);
    for (const [x, z] of [[0, 0], [10.3, -55.1], [200, -200]] as const) {
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
    }
  });

  it('differs between seeds', () => {
    expect(createTerrain(1).heightAt(50, 50)).not.toBe(createTerrain(2).heightAt(50, 50));
  });

  it('does not depend on query order (client and server query differently)', () => {
    const a = createTerrain(7);
    const h = a.heightAt(12.01, 3);
    const b = createTerrain(7);
    b.heightAt(12.2, 3.1);
    expect(b.heightAt(12.01, 3)).toBe(h);
  });

  it('has dry ground at spawn', () => {
    for (const s of [1, 2, 3, 99, 12345]) expect(createTerrain(s).heightAt(0, 0)).toBeGreaterThanOrEqual(0.8);
  });
});

describe('resources', () => {
  const r = generateResources(createTerrain(42), 42);

  it('is deterministic', () => {
    expect(generateResources(createTerrain(42), 42)).toEqual(r);
  });

  it('uses array index as id', () => {
    r.forEach((s, i) => expect(s.id).toBe(i));
  });

  it('has trees, rocks and bushes', () => {
    for (const k of ['tree', 'rock', 'bush'] as const) expect(r.some((s) => s.kind === k)).toBe(true);
  });

  it('keeps spawn clear, stays inside the world and out of water', () => {
    for (const s of r) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(SPAWN_CLEAR);
      expect(Math.abs(s.x)).toBeLessThan(HALF);
      expect(Math.abs(s.z)).toBeLessThan(HALF);
      expect(s.y).toBeGreaterThanOrEqual(WATER_LEVEL);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/worldgen.test.ts`
Expected: FAIL — cannot resolve `./terrain`.

- [ ] **Step 3: Implement**

`src/shared/items.ts` (seed; Task 3 extends):
```ts
export type ItemId = 'wood' | 'stone' | 'berries';
```

`src/shared/terrain.ts`:
```ts
import { Noise2D } from './noise';

export const WORLD_SIZE = 480; // metres, square
export const HALF = WORLD_SIZE / 2;
export const WATER_LEVEL = -3.2;

export interface Terrain {
  heightAt(x: number, z: number): number;
  /** Vegetation density 0..1: clearings vs dense groves. */
  density(x: number, z: number): number;
}

// ponytail: no height cache. The old per-cell cache returned whichever exact point was queried first,
// so client and server could disagree. Recompute is cheap; add a cache keyed on exact coords if profiling says so.
export function createTerrain(seed: number): Terrain {
  const noise = new Noise2D(seed);
  return {
    heightAt(x, z) {
      const n = noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
      const ridge = noise.fbm(x * 0.004, z * 0.004, 3);
      const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
      const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0; // hills at the border keep players in
      let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
      const dSpawn = Math.hypot(x, z);
      if (dSpawn < 24) {
        const t = dSpawn / 24;
        h = Math.max(h, 0.8) * (1 - t) + h * t; // dry, gentle spawn for every seed
      }
      return h;
    },
    density(x, z) {
      return noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    },
  };
}
```

`src/shared/resources.ts`:
```ts
import { createRng } from './rng';
import { HALF, WATER_LEVEL, type Terrain } from './terrain';
import type { ItemId } from './items';

export type ResourceKind = 'tree' | 'rock' | 'bush';

export interface ResourceSpawn {
  id: number;
  kind: ResourceKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  radius: number;
}

export const HARVEST: Record<ResourceKind, { item: ItemId; amount: number; uses: number; regrow: number; label: string }> = {
  tree: { item: 'wood', amount: 1, uses: 3, regrow: 240, label: 'Talar árbol' },
  rock: { item: 'stone', amount: 1, uses: 2, regrow: 300, label: 'Picar piedra' },
  bush: { item: 'berries', amount: 2, uses: 2, regrow: 150, label: 'Recoger bayas' },
};

export const SPAWN_CLEAR = 9;
const STEP = 4.2;

/** Deterministic placement. Every cell consumes exactly 4 rng values so one rule change can't reshuffle the map. */
export function generateResources(terrain: Terrain, seed: number): ResourceSpawn[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const out: ResourceSpawn[] = [];
  for (let x = -HALF + 6; x < HALF - 6; x += STEP) {
    for (let z = -HALF + 6; z < HALF - 6; z += STEP) {
      const jx = x + (rng() - 0.5) * STEP;
      const jz = z + (rng() - 0.5) * STEP;
      const roll = rng();
      const extra = rng();
      if (Math.hypot(jx, jz) < SPAWN_CLEAR) continue;
      const h = terrain.heightAt(jx, jz);
      if (h < WATER_LEVEL) continue;
      const d = terrain.density(jx, jz);
      const rot = extra * Math.PI * 2;
      const push = (kind: ResourceKind, scale: number, radius: number) =>
        out.push({ id: out.length, kind, x: jx, y: h, z: jz, scale, rot, radius });
      if (roll < d * 0.95 && h < 16) {
        const s = 0.8 + extra * 0.7;
        push('tree', s, 0.5 * s);
      } else if (roll < d * 0.95 + 0.04 && h > -2) {
        const s = 0.5 + extra * 0.9;
        push('rock', s, s * 1.1);
      } else if (roll < d * 0.95 + 0.09 && d < 0.6) {
        const s = 0.7 + extra * 0.6;
        push('bush', s, s);
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared/worldgen.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared
git commit -m "feat(shared): deterministic terrain and resource placement"
```

---

### Task 3: Items and vitals

**Files:**
- Modify: `src/shared/items.ts` (replace the one-line seed)
- Create: `src/shared/survival.ts`
- Test: `src/shared/items.test.ts`, `src/shared/survival.test.ts` (new file in `src/shared/`, unrelated to old `src/game/survival.test.ts`)

**Interfaces:**
- Produces (`items.ts`): `ItemId`, `Inventory = Partial<Record<ItemId, number>>`, `ITEMS`, `ITEM_LABELS`, `StructureKind = 'campfire' | 'wall'`, `STRUCTURE_KINDS`, `STRUCTURE_LABELS`, `BUILD_COST: Record<StructureKind, Inventory>`, `count(inv, item): number`, `addItem(inv, item, n): Inventory`, `hasAll(inv, cost): boolean`, `removeAll(inv, cost): Inventory` (throws if insufficient). All functions return new objects.
- Produces (`survival.ts`): `Vitals { health; hunger; warmth }`, `VITAL_MAX`, `RATES`, `BERRY`, `RESPAWN_VITALS`, `clamp`, `createVitals()`, `isNight(dayFraction)`, `VitalsEnv { night; nearFire }`, `tickVitals(v, env, dt): Vitals`, `eatBerry(v): Vitals`, `damage(v, amount): Vitals`.

- [ ] **Step 1: Write failing tests**

`src/shared/items.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addItem, BUILD_COST, count, hasAll, removeAll } from './items';

describe('inventory', () => {
  it('adds without mutating', () => {
    const a = {};
    const b = addItem(a, 'wood', 3);
    expect(a).toEqual({});
    expect(count(b, 'wood')).toBe(3);
  });

  it('checks and removes build costs', () => {
    const inv = { wood: 6, stone: 3 };
    expect(hasAll(inv, BUILD_COST.campfire)).toBe(true);
    expect(removeAll(inv, BUILD_COST.campfire)).toEqual({ wood: 1 });
    expect(hasAll({ wood: 4 }, BUILD_COST.campfire)).toBe(false);
  });

  it('refuses to go negative', () => {
    expect(() => removeAll({ wood: 1 }, { wood: 2 })).toThrow();
  });
});
```

`src/shared/survival.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createVitals, damage, eatBerry, isNight, tickVitals } from './survival';

const day = { night: false, nearFire: false };
const night = { night: true, nearFire: false };

function run(env: typeof day, seconds: number, v = createVitals()) {
  for (let t = 0; t < seconds; t += 0.1) v = tickVitals(v, env, 0.1);
  return v;
}

describe('vitals', () => {
  it('hunger empties in about 10 minutes', () => {
    expect(run(day, 9 * 60).hunger).toBeGreaterThan(0);
    expect(run(day, 10 * 60 + 1).hunger).toBe(0);
  });

  it('night cools, fire warms', () => {
    const cold = run(night, 60);
    expect(cold.warmth).toBeLessThan(100);
    expect(run({ night: true, nearFire: true }, 20, cold).warmth).toBe(100);
  });

  it('starving and freezing hurt', () => {
    const v = run(day, 1, { health: 100, hunger: 0, warmth: 100 });
    expect(v.health).toBeLessThan(100);
    const f = run(night, 1, { health: 100, hunger: 100, warmth: 0 });
    expect(f.health).toBeLessThan(100);
  });

  it('regenerates when fed and warm', () => {
    expect(run(day, 10, { health: 50, hunger: 100, warmth: 100 }).health).toBeGreaterThan(50);
  });

  it('berries feed and clamp', () => {
    expect(eatBerry({ health: 99, hunger: 95, warmth: 50 })).toEqual({ health: 100, hunger: 100, warmth: 50 });
  });

  it('damage floors at 0', () => {
    expect(damage(createVitals(), 150).health).toBe(0);
  });

  it('night window', () => {
    expect(isNight(0.1)).toBe(true);
    expect(isNight(0.5)).toBe(false);
    expect(isNight(0.9)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/items.test.ts src/shared/survival.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement**

`src/shared/items.ts`:
```ts
export type ItemId = 'wood' | 'stone' | 'berries';
export type Inventory = Partial<Record<ItemId, number>>;

export const ITEMS: readonly ItemId[] = ['wood', 'stone', 'berries'];
export const ITEM_LABELS: Record<ItemId, string> = { wood: 'Madera', stone: 'Piedra', berries: 'Bayas' };

export type StructureKind = 'campfire' | 'wall';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
};

export function count(inv: Inventory, item: ItemId): number {
  return inv[item] ?? 0;
}

export function addItem(inv: Inventory, item: ItemId, n: number): Inventory {
  return { ...inv, [item]: count(inv, item) + n };
}

export function hasAll(inv: Inventory, cost: Inventory): boolean {
  return (Object.keys(cost) as ItemId[]).every((k) => count(inv, k) >= (cost[k] ?? 0));
}

export function removeAll(inv: Inventory, cost: Inventory): Inventory {
  if (!hasAll(inv, cost)) throw new Error('not enough items');
  const out: Inventory = { ...inv };
  for (const k of Object.keys(cost) as ItemId[]) {
    const left = count(out, k) - (cost[k] ?? 0);
    if (left > 0) out[k] = left;
    else delete out[k];
  }
  return out;
}
```

`src/shared/survival.ts`:
```ts
/** Co-op vitals: health, hunger, warmth. Pure; time in real seconds; values 0..100. */
export interface Vitals {
  health: number;
  hunger: number; // 100 = full
  warmth: number; // 100 = warm
}

export const VITAL_MAX = 100;

export const RATES = {
  hunger: 100 / (10 * 60),
  warmthNight: 100 / (3 * 60),
  warmthDay: 100 / 60,
  warmthFire: 100 / 20,
  starve: 100 / (2 * 60),
  cold: 100 / 100,
  regen: 100 / (4 * 60),
} as const;

export const BERRY = { hunger: 15, health: 3 } as const;
export const RESPAWN_VITALS: Vitals = { health: 100, hunger: 70, warmth: 80 };

export function clamp(v: number, lo = 0, hi = VITAL_MAX): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createVitals(): Vitals {
  return { health: 100, hunger: 100, warmth: 100 };
}

/** dayFraction 0..1, 0 = midnight. */
export function isNight(dayFraction: number): boolean {
  const f = ((dayFraction % 1) + 1) % 1;
  return f < 0.22 || f > 0.8;
}

export interface VitalsEnv {
  night: boolean;
  nearFire: boolean;
}

export function tickVitals(v: Vitals, env: VitalsEnv, dt: number): Vitals {
  const hunger = clamp(v.hunger - RATES.hunger * dt);
  const warmthRate = env.nearFire ? RATES.warmthFire : env.night ? -RATES.warmthNight : RATES.warmthDay;
  const warmth = clamp(v.warmth + warmthRate * dt);
  let hurt = 0;
  if (hunger === 0) hurt += RATES.starve;
  if (warmth === 0) hurt += RATES.cold;
  const regen = hurt === 0 && hunger > 60 && warmth > 40 ? RATES.regen : 0;
  return { hunger, warmth, health: clamp(v.health + (regen - hurt) * dt) };
}

export function eatBerry(v: Vitals): Vitals {
  return { ...v, hunger: clamp(v.hunger + BERRY.hunger), health: clamp(v.health + BERRY.health) };
}

export function damage(v: Vitals, amount: number): Vitals {
  return { ...v, health: clamp(v.health - amount) };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared
git commit -m "feat(shared): inventory, build costs and co-op vitals"
```

---

### Task 4: Protocol and input validation

**Files:**
- Create: `src/shared/protocol.ts`
- Test: `src/shared/protocol.test.ts`

**Interfaces:**
- Consumes: `Inventory`, `StructureKind`, `STRUCTURE_KINDS` (Task 3); `Vitals` (Task 3).
- Produces: `PROTOCOL_VERSION = 1`, `ANIMS`, `Anim`, `WolfAnim`, `PlayerView`, `WolfView`, `Structure`, `SelfState`, `ErrorCode`, `ClientMsg`, `ServerMsg`, `NAME_RE`, `PIN_RE`, `WORLD_RE`, `decodeClient(raw: string): ClientMsg | null`, `encode(m: ClientMsg | ServerMsg): string`, `r2(n): number`.

- [ ] **Step 1: Write failing test** — `src/shared/protocol.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { decodeClient } from './protocol';

const ok = (m: unknown) => expect(decodeClient(JSON.stringify(m))).toEqual(m);
const bad = (raw: string) => expect(decodeClient(raw)).toBeNull();

describe('decodeClient', () => {
  it('accepts every valid message', () => {
    ok({ t: 'hello', v: 1, name: 'Mateo', pin: '0420' });
    ok({ t: 'hello', v: 1, name: 'José Ñ-2', pin: '1234' });
    ok({ t: 'move', x: 1.5, y: 2, z: -3, yaw: 0.5, anim: 'run' });
    ok({ t: 'harvest', id: 12 });
    ok({ t: 'place', kind: 'wall', x: 1, z: 2, rot: 0 });
    ok({ t: 'attack', id: 3 });
    ok({ t: 'eat' });
    ok({ t: 'respawn' });
  });

  it('rejects garbage', () => {
    bad('not json');
    bad('[]');
    bad('null');
    bad(JSON.stringify({ t: 'fly' }));
  });

  it('rejects bad hello', () => {
    bad(JSON.stringify({ t: 'hello', v: 1, name: '', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'x'.repeat(17), pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: '<b>hi</b>', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: ' Ana', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'Ana', pin: '12a4' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'Ana', pin: '12345' }));
  });

  it('rejects bad numbers and enums', () => {
    bad('{"t":"move","x":1e999,"y":0,"z":0,"yaw":0,"anim":"idle"}');
    bad(JSON.stringify({ t: 'move', x: '1', y: 0, z: 0, yaw: 0, anim: 'idle' }));
    bad(JSON.stringify({ t: 'move', x: 1, y: 0, z: 0, yaw: 0, anim: 'moonwalk' }));
    bad(JSON.stringify({ t: 'harvest', id: -1 }));
    bad(JSON.stringify({ t: 'harvest', id: 1.5 }));
    bad(JSON.stringify({ t: 'place', kind: 'castle', x: 1, z: 2, rot: 0 }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/protocol.test.ts`
Expected: FAIL — cannot resolve `./protocol`.

- [ ] **Step 3: Implement** — `src/shared/protocol.ts`

```ts
import { STRUCTURE_KINDS, type Inventory, type StructureKind } from './items';
import type { Vitals } from './survival';

export const PROTOCOL_VERSION = 1;

export const ANIMS = ['idle', 'walk', 'run', 'jump', 'swim', 'attack'] as const;
export type Anim = (typeof ANIMS)[number];
export type WolfAnim = 'idle' | 'walk' | 'run' | 'attack' | 'dead';

export interface PlayerView { name: string; x: number; y: number; z: number; yaw: number; anim: Anim; away: boolean; dead: boolean }
export interface WolfView { id: number; x: number; y: number; z: number; yaw: number; anim: WolfAnim }
export interface Structure { id: number; kind: StructureKind; x: number; y: number; z: number; rot: number; owner: string }
/** `fix` = the server rejected your last move; snap to x/y/z. */
export interface SelfState { x: number; y: number; z: number; vitals: Vitals; inv: Inventory; dead: boolean; fix: boolean }

export type ErrorCode = 'version' | 'pin' | 'rate' | 'noworld' | 'full' | 'bad';

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; pin: string }
  | { t: 'move'; x: number; y: number; z: number; yaw: number; anim: Anim }
  | { t: 'harvest'; id: number }
  | { t: 'place'; kind: StructureKind; x: number; z: number; rot: number }
  | { t: 'attack'; id: number }
  | { t: 'eat' }
  | { t: 'respawn' };

export type ServerMsg =
  | { t: 'welcome'; you: string; seed: number; time: number; self: SelfState; structures: Structure[]; gone: number[] }
  | { t: 'error'; code: ErrorCode }
  | { t: 'snap'; time: number; players: PlayerView[]; wolves: WolfView[]; self: SelfState }
  | { t: 'res'; id: number; gone: boolean }
  | { t: 'built'; s: Structure }
  | { t: 'toast'; text: string };

export const NAME_RE = /^[\p{L}\p{N} _-]{1,16}$/u;
export const PIN_RE = /^\d{4}$/;
export const WORLD_RE = /^[a-z0-9-]{3,32}$/;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function parse(raw: string): Record<string, unknown> | null {
  try {
    const p: unknown = JSON.parse(raw);
    return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Trust boundary: everything a client sends passes through here. */
export function decodeClient(raw: string): ClientMsg | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.t) {
    case 'hello': {
      const { v, name, pin } = m;
      return num(v) && typeof name === 'string' && name.trim() === name && NAME_RE.test(name) && typeof pin === 'string' && PIN_RE.test(pin)
        ? { t: 'hello', v, name, pin }
        : null;
    }
    case 'move': {
      const { x, y, z, yaw, anim } = m;
      return num(x) && num(y) && num(z) && num(yaw) && (ANIMS as readonly unknown[]).includes(anim)
        ? { t: 'move', x, y, z, yaw, anim: anim as Anim }
        : null;
    }
    case 'harvest':
      return id(m.id) ? { t: 'harvest', id: m.id } : null;
    case 'attack':
      return id(m.id) ? { t: 'attack', id: m.id } : null;
    case 'place': {
      const { kind, x, z, rot } = m;
      return (STRUCTURE_KINDS as readonly unknown[]).includes(kind) && num(x) && num(z) && num(rot)
        ? { t: 'place', kind: kind as StructureKind, x, z, rot }
        : null;
    }
    case 'eat':
      return { t: 'eat' };
    case 'respawn':
      return { t: 'respawn' };
    default:
      return null;
  }
}

export function encode(m: ClientMsg | ServerMsg): string {
  return JSON.stringify(m);
}

/** Round to cm to keep snapshots small. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared/protocol.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/protocol.ts src/shared/protocol.test.ts
git commit -m "feat(shared): wire protocol with validated client decoding"
```

---

### Task 5: Wolf AI (pure)

**Files:**
- Create: `src/shared/sim/wolves.ts`
- Test: `src/shared/sim/wolves.test.ts`

**Interfaces:**
- Consumes: `Terrain`, `HALF`, `WATER_LEVEL` (Task 2); `WolfAnim` (Task 4).
- Produces:
  - `WOLF` tuning constants (`hp`, `walk`, `run`, `sight`, `giveUp`, `reach`, `damage`, `biteCooldown`, `fearRadius`, `count`, `spawnMin`, `spawnMax`, `corpseTime`)
  - `interface Wolf { id; x; y; z; yaw; hp; target: string | null; cooldown; deadFor; wander; anim: WolfAnim }`
  - `interface WolfTarget { name: string; x: number; z: number; dead: boolean; fires: boolean }` (`fires` = standing near a campfire)
  - `createWolf(id, x, z, terrain, rng): Wolf`
  - `stepWolf(w, targets, terrain, dt, rng): string | null` — mutates `w`, returns the name bitten this step
  - `hitWolf(w, dmg): boolean` — true exactly once, when this hit kills

- [ ] **Step 1: Write failing test** — `src/shared/sim/wolves.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { createWolf, hitWolf, stepWolf, WOLF, type WolfTarget } from './wolves';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const rng = () => 0.5;
const target = (x: number, z = 0, extra: Partial<WolfTarget> = {}): WolfTarget => ({ name: 'Ana', x, z, dead: false, fires: false, ...extra });

describe('wolves', () => {
  it('chases the nearest player in sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(10)], flat, 0.1, rng);
    expect(w.target).toBe('Ana');
    expect(w.x).toBeGreaterThan(0);
    expect(w.anim).toBe('run');
  });

  it('ignores players out of sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(WOLF.sight + 5)], flat, 0.1, rng);
    expect(w.target).toBeNull();
    expect(w.anim).toBe('walk');
  });

  it('bites in reach, then waits for the cooldown', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    const t = [target(1)];
    expect(stepWolf(w, t, flat, 0.1, rng)).toBe('Ana');
    expect(stepWolf(w, t, flat, 0.1, rng)).toBeNull();
    let bit: string | null = null;
    for (let i = 0; i < 20 && !bit; i++) bit = stepWolf(w, t, flat, 0.1, rng);
    expect(bit).toBe('Ana');
  });

  it('ignores dead players', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(stepWolf(w, [target(1, 0, { dead: true })], flat, 0.1, rng)).toBeNull();
    expect(w.target).toBeNull();
  });

  it('runs away from players at a fire', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(5, 0, { fires: true })], flat, 0.1, rng);
    expect(w.x).toBeLessThan(0);
    expect(w.target).toBeNull();
  });

  it('does not walk into deep water', () => {
    const lake: Terrain = { heightAt: (x) => (x > 1 ? -10 : 0), density: () => 0.5 };
    const w = createWolf(1, 0.9, 0, lake, rng);
    for (let i = 0; i < 10; i++) stepWolf(w, [target(10)], lake, 0.1, rng);
    expect(w.x).toBeLessThanOrEqual(1);
  });

  it('dies once', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(hitWolf(w, WOLF.hp - 1)).toBe(false);
    expect(hitWolf(w, 5)).toBe(true);
    expect(hitWolf(w, 5)).toBe(false);
    expect(w.anim).toBe('dead');
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/sim/wolves.test.ts`
Expected: FAIL — cannot resolve `./wolves`.

- [ ] **Step 3: Implement** — `src/shared/sim/wolves.ts`

```ts
import { HALF, WATER_LEVEL, type Terrain } from '../terrain';
import type { WolfAnim } from '../protocol';

export const WOLF = {
  hp: 60,
  walk: 2.4,
  run: 6.2,
  sight: 28,
  giveUp: 45,
  reach: 1.8,
  damage: 10,
  biteCooldown: 1.4,
  fearRadius: 6,
  count: 5,
  spawnMin: 35,
  spawnMax: 60,
  corpseTime: 5,
} as const;

export interface Wolf {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  target: string | null;
  cooldown: number;
  deadFor: number;
  wander: number;
  anim: WolfAnim;
}

export interface WolfTarget {
  name: string;
  x: number;
  z: number;
  dead: boolean;
  /** Standing near a campfire: wolves keep away. */
  fires: boolean;
}

export function createWolf(id: number, x: number, z: number, terrain: Terrain, rng: () => number): Wolf {
  return { id, x, y: terrain.heightAt(x, z), z, yaw: 0, hp: WOLF.hp, target: null, cooldown: 0, deadFor: 0, wander: rng() * Math.PI * 2, anim: 'idle' };
}

const dist = (w: Wolf, t: WolfTarget) => Math.hypot(t.x - w.x, t.z - w.z);

export function stepWolf(w: Wolf, targets: WolfTarget[], terrain: Terrain, dt: number, rng: () => number): string | null {
  if (w.hp <= 0) {
    w.deadFor += dt;
    w.anim = 'dead';
    return null;
  }
  w.cooldown = Math.max(0, w.cooldown - dt);

  const huntable = (t: WolfTarget) => !t.dead && !t.fires;
  let target = targets.find((t) => t.name === w.target && huntable(t) && dist(w, t) < WOLF.giveUp) ?? null;
  if (!target) {
    let best = WOLF.sight;
    for (const t of targets) {
      const d = dist(w, t);
      if (huntable(t) && d < best) {
        best = d;
        target = t;
      }
    }
  }

  let dirX = 0;
  let dirZ = 0;
  let speed = 0;
  let bitten: string | null = null;
  const scary = targets.find((t) => t.fires && dist(w, t) < WOLF.fearRadius + 4);

  if (scary) {
    const d = Math.max(dist(w, scary), 1e-4);
    dirX = (w.x - scary.x) / d;
    dirZ = (w.z - scary.z) / d;
    speed = WOLF.run;
    target = null;
  } else if (target) {
    const d = Math.max(dist(w, target), 1e-4);
    dirX = (target.x - w.x) / d;
    dirZ = (target.z - w.z) / d;
    if (d > WOLF.reach) {
      speed = WOLF.run;
    } else {
      w.yaw = Math.atan2(dirX, dirZ);
      if (w.cooldown === 0) {
        w.cooldown = WOLF.biteCooldown;
        bitten = target.name;
      }
    }
  } else {
    w.wander += (rng() - 0.5) * dt * 1.5;
    dirX = Math.sin(w.wander);
    dirZ = Math.cos(w.wander);
    speed = WOLF.walk;
  }
  w.target = target?.name ?? null;

  if (speed > 0) {
    const nx = Math.max(-HALF + 4, Math.min(HALF - 4, w.x + dirX * speed * dt));
    const nz = Math.max(-HALF + 4, Math.min(HALF - 4, w.z + dirZ * speed * dt));
    if (terrain.heightAt(nx, nz) < WATER_LEVEL) {
      w.wander += Math.PI; // turn around at the shore
    } else {
      w.x = nx;
      w.z = nz;
      w.y = terrain.heightAt(nx, nz);
    }
    w.yaw = Math.atan2(dirX, dirZ);
  }
  w.anim = speed === 0 ? (target ? 'attack' : 'idle') : speed >= WOLF.run ? 'run' : 'walk';
  return bitten;
}

export function hitWolf(w: Wolf, dmg: number): boolean {
  if (w.hp <= 0) return false;
  w.hp = Math.max(0, w.hp - dmg);
  if (w.hp > 0) return false;
  w.anim = 'dead';
  w.target = null;
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared/sim/wolves.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/sim
git commit -m "feat(shared): night wolf AI"
```

---

### Task 6: WorldSim — the authoritative world

**Files:**
- Create: `src/shared/sim/world-sim.ts`
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5 (`createTerrain`, `generateResources`, `HARVEST`, items ops, vitals, protocol types, `r2`, wolves).
- Produces (used by Task 8 room and Task 14 client):
  - constants `DAY_LENGTH = 360`, `TICK_DT = 0.1`, `VIEW_RADIUS = 100`, `MAX_SPEED = 9`, `REACH = 3.5`, `BUILD_REACH = 6`, `FIRE_RADIUS = 4`, `AWAY_TIMEOUT = 30`, `MAX_STRUCTURES = 500`, `MAX_ONLINE = 8`, `PUNCH = { damage: 20, cooldown: 0.6, reach: 3 }`, `HARVEST_COOLDOWN = 0.4`
  - `interface SavedPlayer { name; pinHash; x; y; z; yaw; vitals; inv; dead }`
  - `interface SavedWorld { version: 1; seed; salt; time; nextStructureId; structures: Structure[]; resources: Record<string, { uses: number; regrow: number }>; players: SavedPlayer[] }`
  - `interface Outgoing { to: string | null; msg: ServerMsg }` (`null` = everyone connected)
  - `newWorld(seed: number, salt: string): SavedWorld`
  - `dayFraction(time: number): number`
  - `class WorldSim` with: `seed`, `salt`, `terrain`, `resources`, `time`, `getPlayer(name)`, `onlineNames()`, `activeCount()`, `createPlayer(name, pinHash)`, `connect(name): ServerMsg` (welcome), `markAway(name)`, `handle(name, msg: ClientMsg)`, `step(dt)`, `snapshotFor(name): ServerMsg | null`, `drain(): Outgoing[]`, `save(): SavedWorld`, `spawnFor(name): { x; z }`, `wolfList` (readonly getter, for tests)

- [ ] **Step 1: Write failing test** — `src/shared/sim/world-sim.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { HARVEST } from '../resources';
import type { ServerMsg } from '../protocol';
import { AWAY_TIMEOUT, DAY_LENGTH, newWorld, WorldSim } from './world-sim';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  return sim;
}

/** Teleport for tests (bypasses move validation). */
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}

const tree = (sim: WorldSim) => sim.resources.find((r) => r.kind === 'tree')!;
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const snap = (sim: WorldSim, name: string) => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;

describe('WorldSim', () => {
  it('welcomes a new player at spawn', () => {
    const sim = new WorldSim(newWorld(42, 'salt'));
    sim.createPlayer('Ana', 'h');
    const w = sim.connect('Ana');
    expect(w.t).toBe('welcome');
    if (w.t !== 'welcome') return;
    expect(w.seed).toBe(42);
    expect(w.self.x).toBe(0);
    expect(w.self.inv).toEqual({});
  });

  it('accepts plausible moves and rejects teleports', () => {
    const sim = setup('Ana');
    const y = sim.terrain.heightAt(0.5, 0);
    sim.handle('Ana', { t: 'move', x: 0.5, y, z: 0, yaw: 0, anim: 'walk' });
    expect(sim.getPlayer('Ana')!.x).toBe(0.5);
    sim.handle('Ana', { t: 'move', x: 80, y: sim.terrain.heightAt(80, 0), z: 0, yaw: 0, anim: 'run' });
    expect(sim.getPlayer('Ana')!.x).toBe(0.5);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    expect(snap(sim, 'Ana').self.fix).toBe(false);
  });

  it('harvests in reach, with cooldown, and depletes then regrows', () => {
    const sim = setup('Ana', 'Leo');
    const t = tree(sim);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    expect(sim.getPlayer('Ana')!.inv.wood ?? 0).toBe(0); // too far
    put(sim, 'Ana', t.x + 1, t.z);
    sim.handle('Ana', { t: 'harvest', id: t.id });
    sim.handle('Ana', { t: 'harvest', id: t.id }); // cooldown
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(1);
    for (let i = 0; i < HARVEST.tree.uses; i++) {
      sim.step(0.5);
      sim.handle('Ana', { t: 'harvest', id: t.id });
    }
    expect(sim.getPlayer('Ana')!.inv.wood).toBe(HARVEST.tree.uses);
    expect(msgs(sim)).toContainEqual({ t: 'res', id: t.id, gone: true });
    for (let s = 0; s < HARVEST.tree.regrow + 1; s += 1) sim.step(1);
    expect(msgs(sim)).toContainEqual({ t: 'res', id: t.id, gone: false });
  });

  it('builds a campfire when affordable and uses it as spawn', () => {
    const sim = setup('Ana');
    sim.handle('Ana', { t: 'place', kind: 'campfire', x: 2, z: 0, rot: 0 });
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Faltan materiales' });
    sim.getPlayer('Ana')!.inv = { wood: 6, stone: 3 };
    sim.handle('Ana', { t: 'place', kind: 'campfire', x: 2, z: 0, rot: 0 });
    const out = msgs(sim);
    expect(out.some((m) => m.t === 'built' && m.s.kind === 'campfire' && m.s.owner === 'Ana')).toBe(true);
    expect(sim.getPlayer('Ana')!.inv).toEqual({ wood: 1 });
    sim.getPlayer('Ana')!.inv = { wood: 4 };
    sim.handle('Ana', { t: 'place', kind: 'wall', x: 2.5, z: 0, rot: 0 });
    expect(msgs(sim)).toContainEqual({ t: 'toast', text: 'Hay algo en el camino' });
    expect(sim.spawnFor('Ana')).toEqual({ x: 3.5, z: 0 });
  });

  it('eats berries', () => {
    const sim = setup('Ana');
    const p = sim.getPlayer('Ana')!;
    p.inv = { berries: 2 };
    p.vitals.hunger = 50;
    sim.handle('Ana', { t: 'eat' });
    expect(p.inv).toEqual({ berries: 1 });
    expect(p.vitals.hunger).toBe(65);
  });

  it('shows nearby players, hides far ones, and times out away players', () => {
    const sim = setup('Ana', 'Leo', 'Mia');
    put(sim, 'Mia', 150, 0);
    const s = snap(sim, 'Ana');
    expect(s.players.map((p) => p.name)).toEqual(['Leo']);
    sim.markAway('Leo');
    expect(snap(sim, 'Ana').players[0]!.away).toBe(true);
    for (let t = 0; t <= AWAY_TIMEOUT; t += 1) sim.step(1);
    expect(sim.onlineNames()).not.toContain('Leo');
  });

  it('spawns wolves at nightfall near active players and clears them at dawn', () => {
    const sim = setup('Ana');
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    expect(sim.wolfList.length).toBeGreaterThan(0);
    sim.time = DAY_LENGTH * 1.3;
    sim.step(0.1);
    expect(sim.wolfList.length).toBe(0);
  });

  it('wolves hurt and kill; respawn restores and keeps inventory', () => {
    const sim = setup('Ana');
    sim.getPlayer('Ana')!.inv = { wood: 2 };
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    const w = sim.wolfList[0]!;
    put(sim, 'Ana', w.x + 1, w.z);
    for (let i = 0; i < 400 && !sim.getPlayer('Ana')!.dead; i++) {
      w.x = sim.getPlayer('Ana')!.x - 1; // keep it glued to the player
      w.z = sim.getPlayer('Ana')!.z;
      sim.step(0.1);
    }
    const p = sim.getPlayer('Ana')!;
    expect(p.dead).toBe(true);
    sim.handle('Ana', { t: 'respawn' });
    expect(p.dead).toBe(false);
    expect(p.vitals.health).toBe(100);
    expect(p.inv).toEqual({ wood: 2 });
  });

  it('punches wolves to death with a cooldown', () => {
    const sim = setup('Ana');
    sim.time = DAY_LENGTH * 0.85;
    sim.step(0.1);
    const w = sim.wolfList[0]!;
    put(sim, 'Ana', w.x + 1, w.z);
    sim.handle('Ana', { t: 'attack', id: w.id });
    sim.handle('Ana', { t: 'attack', id: w.id }); // cooldown
    expect(w.hp).toBe(40);
    for (let i = 0; i < 3; i++) {
      sim.time += 1;
      w.x = sim.getPlayer('Ana')!.x - 1;
      w.z = sim.getPlayer('Ana')!.z;
      sim.handle('Ana', { t: 'attack', id: w.id });
    }
    expect(w.hp).toBe(0);
  });

  it('round-trips through save()', () => {
    const sim = setup('Ana');
    const t = tree(sim);
    put(sim, 'Ana', t.x + 1, t.z);
    for (let i = 0; i < HARVEST.tree.uses; i++) {
      sim.step(0.5);
      sim.handle('Ana', { t: 'harvest', id: t.id });
    }
    sim.getPlayer('Ana')!.inv = { ...sim.getPlayer('Ana')!.inv, wood: 4 };
    sim.handle('Ana', { t: 'place', kind: 'wall', x: t.x + 3, z: t.z, rot: 0 });
    const copy = new WorldSim(JSON.parse(JSON.stringify(sim.save())));
    expect(copy.time).toBe(sim.time);
    expect(copy.getPlayer('Ana')).toEqual(sim.getPlayer('Ana'));
    copy.createPlayer('Leo', 'h');
    const w = copy.connect('Leo');
    if (w.t !== 'welcome') throw new Error('expected welcome');
    expect(w.gone).toContain(t.id);
    expect(w.structures).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/sim/world-sim.test.ts`
Expected: FAIL — cannot resolve `./world-sim`.

- [ ] **Step 3: Implement** — `src/shared/sim/world-sim.ts`

```ts
import { createRng } from '../rng';
import { createTerrain, HALF, WATER_LEVEL, type Terrain } from '../terrain';
import { generateResources, HARVEST, type ResourceSpawn } from '../resources';
import { addItem, BUILD_COST, count, hasAll, removeAll, type Inventory, type StructureKind } from '../items';
import { createVitals, damage, eatBerry, isNight, RESPAWN_VITALS, tickVitals, type Vitals } from '../survival';
import { r2, type Anim, type ClientMsg, type PlayerView, type SelfState, type ServerMsg, type Structure, type WolfView } from '../protocol';
import { createWolf, hitWolf, stepWolf, WOLF, type Wolf, type WolfTarget } from './wolves';

export const DAY_LENGTH = 6 * 60;
export const TICK_DT = 0.1;
export const VIEW_RADIUS = 100;
export const MAX_SPEED = 9;
export const REACH = 3.5;
export const BUILD_REACH = 6;
export const FIRE_RADIUS = 4;
export const AWAY_TIMEOUT = 30;
export const MAX_STRUCTURES = 500;
export const MAX_ONLINE = 8;
export const PUNCH = { damage: 20, cooldown: 0.6, reach: 3 } as const;
export const HARVEST_COOLDOWN = 0.4;

const BUILT_TEXT: Record<StructureKind, string> = { campfire: 'Fogata encendida', wall: 'Muro levantado' };

export interface SavedPlayer {
  name: string;
  pinHash: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vitals: Vitals;
  inv: Inventory;
  dead: boolean;
}

export interface SavedWorld {
  version: 1;
  seed: number;
  salt: string;
  time: number;
  nextStructureId: number;
  structures: Structure[];
  /** Only resources that are partly or fully harvested. */
  resources: Record<string, { uses: number; regrow: number }>;
  players: SavedPlayer[];
}

export interface Outgoing {
  /** null = everyone connected */
  to: string | null;
  msg: ServerMsg;
}

interface Live {
  anim: Anim;
  awayFor: number | null;
  lastMoveAt: number;
  harvestReadyAt: number;
  punchReadyAt: number;
  fix: boolean;
}

export function newWorld(seed: number, salt: string): SavedWorld {
  return { version: 1, seed, salt, time: DAY_LENGTH * 0.33, nextStructureId: 1, structures: [], resources: {}, players: [] };
}

export function dayFraction(time: number): number {
  return (time % DAY_LENGTH) / DAY_LENGTH;
}

export class WorldSim {
  readonly seed: number;
  readonly salt: string;
  readonly terrain: Terrain;
  readonly resources: ResourceSpawn[];
  time: number;
  private readonly players = new Map<string, SavedPlayer>();
  private readonly live = new Map<string, Live>();
  private readonly resState = new Map<number, { uses: number; regrow: number }>();
  private readonly structures: Structure[];
  private nextStructureId: number;
  private wolves: Wolf[] = [];
  private nextWolfId = 1;
  private wasNight = false; // false on load so a night-time load still spawns wolves
  private outbox: Outgoing[] = [];
  private readonly rng: () => number;

  constructor(saved: SavedWorld) {
    this.seed = saved.seed;
    this.salt = saved.salt;
    this.time = saved.time;
    this.terrain = createTerrain(saved.seed);
    this.resources = generateResources(this.terrain, saved.seed);
    for (const p of saved.players) this.players.set(p.name, structuredClone(p));
    for (const [id, st] of Object.entries(saved.resources)) this.resState.set(Number(id), { ...st });
    this.structures = saved.structures.map((s) => ({ ...s }));
    this.nextStructureId = saved.nextStructureId;
    this.rng = createRng(saved.seed ^ 0x51f15e);
  }

  get wolfList(): readonly Wolf[] {
    return this.wolves;
  }

  getPlayer(name: string): SavedPlayer | undefined {
    return this.players.get(name);
  }

  /** Connected or still in the away grace period. */
  onlineNames(): string[] {
    return [...this.live.keys()];
  }

  activeCount(): number {
    let n = 0;
    for (const l of this.live.values()) if (l.awayFor === null) n++;
    return n;
  }

  /** New record at world spawn. The room has already checked the PIN. */
  createPlayer(name: string, pinHash: string): SavedPlayer {
    const p: SavedPlayer = { name, pinHash, x: 0, y: this.terrain.heightAt(0, 0), z: 0, yaw: 0, vitals: createVitals(), inv: {}, dead: false };
    this.players.set(name, p);
    return p;
  }

  connect(name: string): ServerMsg {
    const p = this.players.get(name);
    if (!p) throw new Error(`unknown player ${name}`);
    let l = this.live.get(name);
    if (l) {
      l.awayFor = null;
      l.lastMoveAt = this.time;
    } else {
      l = { anim: 'idle', awayFor: null, lastMoveAt: this.time, harvestReadyAt: 0, punchReadyAt: 0, fix: false };
      this.live.set(name, l);
    }
    const gone = [...this.resState].filter(([, s]) => s.uses === 0).map(([id]) => id);
    return { t: 'welcome', you: name, seed: this.seed, time: this.time, self: this.selfState(p, l), structures: this.structures.map((s) => ({ ...s })), gone };
  }

  markAway(name: string): void {
    const l = this.live.get(name);
    if (!l) return;
    l.awayFor = 0;
    l.anim = 'idle';
  }

  handle(name: string, msg: ClientMsg): void {
    const p = this.players.get(name);
    const l = this.live.get(name);
    if (!p || !l || l.awayFor !== null) return;
    switch (msg.t) {
      case 'move':
        return this.onMove(p, l, msg);
      case 'harvest':
        return this.onHarvest(p, l, msg.id);
      case 'place':
        return this.onPlace(p, msg.kind, msg.x, msg.z, msg.rot);
      case 'attack':
        return this.onAttack(p, l, msg.id);
      case 'eat':
        return this.onEat(p);
      case 'respawn':
        return this.onRespawn(p, l);
      case 'hello':
        return; // the room handles hello
    }
  }

  step(dt: number): void {
    this.time += dt;
    const night = isNight(dayFraction(this.time));

    for (const [name, l] of this.live) {
      if (l.awayFor === null) continue;
      l.awayFor += dt;
      if (l.awayFor >= AWAY_TIMEOUT) this.live.delete(name);
    }

    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) continue; // away players are frozen: the world sleeps for them
      p.vitals = tickVitals(p.vitals, { night, nearFire: this.nearFire(p.x, p.z) }, dt);
      if (p.vitals.health <= 0) this.kill(p);
    }

    for (const [id, st] of this.resState) {
      if (st.uses !== 0) continue;
      st.regrow -= dt;
      if (st.regrow <= 0) {
        this.resState.delete(id);
        this.outbox.push({ to: null, msg: { t: 'res', id, gone: false } });
      }
    }

    if (night && !this.wasNight) this.spawnWolves();
    if (!night && this.wasNight) this.wolves = [];
    this.wasNight = night;

    const targets = this.targets();
    for (const w of this.wolves) {
      const bit = stepWolf(w, targets, this.terrain, dt, this.rng);
      if (!bit) continue;
      const p = this.players.get(bit)!;
      p.vitals = damage(p.vitals, WOLF.damage);
      if (p.vitals.health <= 0) this.kill(p);
    }
    this.wolves = this.wolves.filter((w) => w.deadFor < WOLF.corpseTime);
  }

  snapshotFor(name: string): ServerMsg | null {
    const p = this.players.get(name);
    const l = this.live.get(name);
    if (!p || !l) return null;
    const near = (x: number, z: number) => Math.hypot(x - p.x, z - p.z) <= VIEW_RADIUS;
    const players: PlayerView[] = [];
    for (const [n, ol] of this.live) {
      if (n === name) continue;
      const o = this.players.get(n)!;
      if (!near(o.x, o.z)) continue;
      players.push({ name: n, x: r2(o.x), y: r2(o.y), z: r2(o.z), yaw: r2(o.yaw), anim: ol.anim, away: ol.awayFor !== null, dead: o.dead });
    }
    const wolves: WolfView[] = this.wolves
      .filter((w) => near(w.x, w.z))
      .map((w) => ({ id: w.id, x: r2(w.x), y: r2(w.y), z: r2(w.z), yaw: r2(w.yaw), anim: w.anim }));
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l) };
  }

  drain(): Outgoing[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  save(): SavedWorld {
    return {
      version: 1,
      seed: this.seed,
      salt: this.salt,
      time: this.time,
      nextStructureId: this.nextStructureId,
      structures: this.structures.map((s) => ({ ...s })),
      resources: Object.fromEntries([...this.resState].map(([id, s]) => [String(id), { ...s }])),
      players: [...this.players.values()].map((p) => structuredClone(p)),
    };
  }

  /** Newest campfire the player built, else the world spawn. */
  spawnFor(name: string): { x: number; z: number } {
    const fire = [...this.structures].reverse().find((s) => s.kind === 'campfire' && s.owner === name);
    return fire ? { x: fire.x + 1.5, z: fire.z } : { x: 0, z: 0 };
  }

  // ---------------------------------------------------------------- actions

  private onMove(p: SavedPlayer, l: Live, m: Extract<ClientMsg, { t: 'move' }>): void {
    if (p.dead) return;
    const elapsed = Math.max(this.time - l.lastMoveAt, TICK_DT);
    const moved = Math.hypot(m.x - p.x, m.z - p.z);
    const inBounds = Math.abs(m.x) < HALF - 2 && Math.abs(m.z) < HALF - 2;
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL - 0.9);
    const yOk = m.y > ground - 1 && m.y < ground + 4;
    // ponytail: speed + bounds sanity check only, no server physics. Fine for co-op; add server-side collision if cheating matters.
    if (!inBounds || !yOk || moved > MAX_SPEED * elapsed + 1) {
      l.fix = true;
      return;
    }
    p.x = m.x;
    p.y = m.y;
    p.z = m.z;
    p.yaw = m.yaw;
    l.anim = m.anim;
    l.lastMoveAt = this.time;
  }

  private onHarvest(p: SavedPlayer, l: Live, id: number): void {
    const r = this.resources[id];
    if (!r || p.dead || this.time < l.harvestReadyAt) return;
    if (Math.hypot(r.x - p.x, r.z - p.z) > REACH + r.radius) return;
    const def = HARVEST[r.kind];
    const st = this.resState.get(id) ?? { uses: def.uses, regrow: 0 };
    if (st.uses <= 0) return;
    st.uses -= 1;
    l.harvestReadyAt = this.time + HARVEST_COOLDOWN;
    p.inv = addItem(p.inv, def.item, def.amount);
    if (st.uses === 0) {
      st.regrow = def.regrow;
      this.outbox.push({ to: null, msg: { t: 'res', id, gone: true } });
    }
    this.resState.set(id, st);
  }

  private onPlace(p: SavedPlayer, kind: StructureKind, x: number, z: number, rot: number): void {
    const toast = (text: string) => this.outbox.push({ to: p.name, msg: { t: 'toast', text } });
    if (p.dead) return;
    if (!hasAll(p.inv, BUILD_COST[kind])) return toast('Faltan materiales');
    if (Math.hypot(x - p.x, z - p.z) > BUILD_REACH) return toast('Demasiado lejos');
    const y = this.terrain.heightAt(x, z);
    if (y < WATER_LEVEL || Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4) return toast('No se puede construir aquí');
    if (this.structures.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) return toast('Hay algo en el camino');
    if (this.structures.length >= MAX_STRUCTURES) return toast('El mundo ya tiene demasiadas construcciones');
    p.inv = removeAll(p.inv, BUILD_COST[kind]);
    const s: Structure = { id: this.nextStructureId++, kind, x: r2(x), y: r2(y), z: r2(z), rot: r2(rot), owner: p.name };
    this.structures.push(s);
    this.outbox.push({ to: null, msg: { t: 'built', s } });
    toast(BUILT_TEXT[kind]);
  }

  private onAttack(p: SavedPlayer, l: Live, id: number): void {
    const w = this.wolves.find((x) => x.id === id);
    if (!w || w.hp <= 0 || p.dead || this.time < l.punchReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > PUNCH.reach) return;
    l.punchReadyAt = this.time + PUNCH.cooldown;
    l.anim = 'attack';
    if (hitWolf(w, PUNCH.damage)) this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} derrotó a un lobo` } });
  }

  private onEat(p: SavedPlayer): void {
    if (p.dead || count(p.inv, 'berries') < 1) return;
    p.inv = removeAll(p.inv, { berries: 1 });
    p.vitals = eatBerry(p.vitals);
  }

  private onRespawn(p: SavedPlayer, l: Live): void {
    if (!p.dead) return;
    const sp = this.spawnFor(p.name);
    p.x = sp.x;
    p.z = sp.z;
    p.y = this.terrain.heightAt(sp.x, sp.z);
    p.vitals = { ...RESPAWN_VITALS };
    p.dead = false;
    l.fix = true;
    l.lastMoveAt = this.time;
  }

  // ---------------------------------------------------------------- helpers

  private selfState(p: SavedPlayer, l: Live): SelfState {
    const fix = l.fix;
    l.fix = false;
    const v = p.vitals;
    return {
      x: r2(p.x),
      y: r2(p.y),
      z: r2(p.z),
      vitals: { health: Math.round(v.health), hunger: Math.round(v.hunger), warmth: Math.round(v.warmth) },
      inv: { ...p.inv },
      dead: p.dead,
      fix,
    };
  }

  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    return this.structures.some((s) => s.kind === 'campfire' && Math.hypot(s.x - x, s.z - z) < r);
  }

  private targets(): WolfTarget[] {
    const out: WolfTarget[] = [];
    for (const [name, l] of this.live) {
      if (l.awayFor !== null) continue;
      const p = this.players.get(name)!;
      out.push({ name, x: p.x, z: p.z, dead: p.dead, fires: this.nearFire(p.x, p.z, WOLF.fearRadius) });
    }
    return out;
  }

  private spawnWolves(): void {
    const anchors = this.targets();
    if (!anchors.length) return;
    for (let i = 0; i < WOLF.count; i++) {
      const a = anchors[i % anchors.length]!;
      for (let tries = 0; tries < 10; tries++) {
        const ang = this.rng() * Math.PI * 2;
        const d = WOLF.spawnMin + this.rng() * (WOLF.spawnMax - WOLF.spawnMin);
        const x = a.x + Math.sin(ang) * d;
        const z = a.z + Math.cos(ang) * d;
        if (Math.abs(x) < HALF - 5 && Math.abs(z) < HALF - 5 && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng));
          break;
        }
      }
    }
  }

  private kill(p: SavedPlayer): void {
    if (p.dead) return;
    p.dead = true;
    p.vitals = { ...p.vitals, health: 0 };
    this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} ha caído` } });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/shared`
Expected: PASS. If `wolves hurt and kill` is flaky because the wolf flees (Ana near no fire, so it shouldn't), print `w.anim` and `w.target` before adjusting the test. Do not weaken assertions.

- [ ] **Step 5: Commit**

```bash
git add src/shared/sim
git commit -m "feat(shared): authoritative WorldSim with building, wolves and save/load"
```

---

### Task 7: PIN hashing and join rate limiting

**Files:**
- Create: `src/server/auth.ts`
- Test: `src/server/auth.test.ts` (runs in the Node suite; Node 24 has `crypto.subtle`)

**Interfaces:**
- Produces: `hashPin(pin: string, salt: string): Promise<string>` (hex SHA-256 of `${salt}:${pin}`), `class RateLimiter { constructor(free = 5, baseMs = 30_000, maxMs = 900_000); blocked(key, now): boolean; fail(key, now): void; succeed(key): void }`.

- [ ] **Step 1: Write failing test** — `src/server/auth.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { hashPin, RateLimiter } from './auth';

describe('hashPin', () => {
  it('is stable, salted and not the PIN', async () => {
    const a = await hashPin('1234', 'salt-a');
    expect(a).toBe(await hashPin('1234', 'salt-a'));
    expect(a).not.toBe(await hashPin('1234', 'salt-b'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RateLimiter', () => {
  it('allows 4 failures, blocks on the 5th, backs off, and resets on success', () => {
    const r = new RateLimiter(5, 1000, 8000);
    for (let i = 0; i < 4; i++) r.fail('Ana', 0);
    expect(r.blocked('Ana', 0)).toBe(false);
    r.fail('Ana', 0);
    expect(r.blocked('Ana', 999)).toBe(true);
    expect(r.blocked('Ana', 1000)).toBe(false);
    r.fail('Ana', 1000); // 6th → 2000 ms
    expect(r.blocked('Ana', 2999)).toBe(true);
    expect(r.blocked('Leo', 0)).toBe(false);
    r.succeed('Ana');
    expect(r.blocked('Ana', 1001)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server/auth.test.ts`
Expected: FAIL — cannot resolve `./auth`.

- [ ] **Step 3: Implement** — `src/server/auth.ts`

```ts
/**
 * ponytail: 4-digit PIN + per-world salt + SHA-256. Online guessing is rate-limited; the hash only lives in
 * admin-only storage. Upgrade to PBKDF2 or real accounts if worlds ever go public.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Per-name backoff: the Nth failure (N >= free) locks for base * 2^(N-free), capped. In-memory: resets if the room restarts. */
export class RateLimiter {
  private readonly state = new Map<string, { fails: number; until: number }>();

  constructor(
    private readonly free = 5,
    private readonly baseMs = 30_000,
    private readonly maxMs = 15 * 60_000,
  ) {}

  blocked(key: string, now: number): boolean {
    const s = this.state.get(key);
    return !!s && now < s.until;
  }

  fail(key: string, now: number): void {
    const s = this.state.get(key) ?? { fails: 0, until: 0 };
    s.fails++;
    if (s.fails >= this.free) s.until = now + Math.min(this.maxMs, this.baseMs * 2 ** (s.fails - this.free));
    this.state.set(key, s);
  }

  succeed(key: string): void {
    this.state.delete(key);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/server/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts src/server/auth.test.ts
git commit -m "feat(server): salted PIN hash and join backoff"
```

---

### Task 8: Worker router and WorldRoom Durable Object

**Files:**
- Create: `wrangler.jsonc`, `src/server/index.ts`, `src/server/world-room.ts`, `src/server/tsconfig.json`, `vitest.workers.config.ts`, `test/workers/tsconfig.json`, `test/workers/helpers.ts`, `test/workers/room.test.ts`, `.dev.vars` (gitignored)
- Generate: `worker-configuration.d.ts` (committed)

**Interfaces:**
- Consumes: `WorldSim`, `newWorld`, `TICK_DT`, `MAX_ONLINE`, `SavedWorld` (Task 6); `decodeClient`, `encode`, `PROTOCOL_VERSION`, `WORLD_RE`, `ClientMsg`, `ErrorCode`, `ServerMsg` (Task 4); `hashPin`, `RateLimiter` (Task 7).
- Produces (HTTP surface used by client, bot test and Gabriel):
  - `GET /ws/:world` with `Upgrade: websocket` → JSON protocol
  - `POST /admin/:world/create` body `{ "seed"?: number }` → `{ ok: true, seed }` | 409 `{ error: 'exists' }`
  - `GET /admin/:world/export` → `SavedWorld` JSON | 404
  - `POST /admin/:world/import` body `SavedWorld` → `{ ok: true }` | 400
  - admin routes need header `Authorization: Bearer <ADMIN_TOKEN>`, else 401
  - everything else → static assets (`dist/`)
  - test helpers `BASE`, `ADMIN`, `createWorld(world, seed?)`, `class Client { static open(world); send(m); next(t, timeout?); join(name, pin?); close() }`

- [ ] **Step 1: Config files**

`wrangler.jsonc`:
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "bosque",
  "main": "src/server/index.ts",
  // If wrangler rejects this date as newer than its runtime, use the date it suggests.
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/ws/*", "/admin/*"]
  },
  "durable_objects": { "bindings": [{ "name": "WORLDS", "class_name": "WorldRoom" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["WorldRoom"] }],
  "observability": { "enabled": true }
}
```

`.dev.vars` (not committed):
```
ADMIN_TOKEN=dev-admin
```

`src/server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["./**/*.ts", "../shared/**/*.ts", "../../worker-configuration.d.ts"],
  "exclude": ["./**/*.test.ts", "../shared/**/*.test.ts"]
}
```

`vitest.workers.config.ts`:
```ts
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { ADMIN_TOKEN: 'test-admin' } },
    }),
  ],
  test: { include: ['test/workers/**/*.test.ts'], testTimeout: 30_000 },
});
```

`test/workers/tsconfig.json`:
```json
{
  "extends": "../../src/server/tsconfig.json",
  "compilerOptions": { "types": ["@cloudflare/vitest-plugin/types"] },
  "include": ["./**/*.ts", "../../src/server/**/*.ts", "../../src/shared/**/*.ts", "../../worker-configuration.d.ts"]
}
```

- [ ] **Step 2: Write test helpers and the failing test**

`test/workers/helpers.ts`:
```ts
import { exports } from 'cloudflare:workers';
import { PROTOCOL_VERSION, type ClientMsg, type ServerMsg } from '../../src/shared/protocol';

export const BASE = 'http://bosque.test';
export const ADMIN = { Authorization: 'Bearer test-admin' };

export function createWorld(world: string, seed = 42): Promise<Response> {
  return exports.default.fetch(`${BASE}/admin/${world}/create`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ seed }) });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Client {
  readonly msgs: ServerMsg[] = [];
  private constructor(readonly ws: WebSocket) {
    ws.addEventListener('message', (e) => this.msgs.push(JSON.parse(String(e.data)) as ServerMsg));
  }

  static async open(world: string): Promise<Client> {
    const res = await exports.default.fetch(`${BASE}/ws/${world}`, { headers: { Upgrade: 'websocket' } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`no websocket, status ${res.status}`);
    ws.accept();
    return new Client(ws);
  }

  send(m: ClientMsg): void {
    this.ws.send(JSON.stringify(m));
  }

  /** Waits for (and removes) the first message of type t. */
  async next<T extends ServerMsg['t']>(t: T, timeout = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const i = this.msgs.findIndex((m) => m.t === t);
      if (i >= 0) return this.msgs.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      await sleep(20);
    }
    throw new Error(`timeout waiting for ${t}; got ${this.msgs.map((m) => m.t).join(',')}`);
  }

  async join(name: string, pin = '1234') {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name, pin });
    return this.next('welcome');
  }

  close(): void {
    this.ws.close(1000, 'bye');
  }
}
```

`test/workers/room.test.ts`:
```ts
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ADMIN, BASE, Client, createWorld, sleep } from './helpers';

describe('admin', () => {
  it('requires the token', async () => {
    const res = await exports.default.fetch(`${BASE}/admin/nope/export`);
    expect(res.status).toBe(401);
  });

  it('creates once, exports and imports', async () => {
    expect((await createWorld('adm-1', 7)).status).toBe(200);
    expect((await createWorld('adm-1', 7)).status).toBe(409);
    const saved = await (await exports.default.fetch(`${BASE}/admin/adm-1/export`, { headers: ADMIN })).json<{ seed: number }>();
    expect(saved.seed).toBe(7);
    const imp = await exports.default.fetch(`${BASE}/admin/adm-1/import`, { method: 'POST', headers: ADMIN, body: JSON.stringify(saved) });
    expect(imp.status).toBe(200);
    const bad = await exports.default.fetch(`${BASE}/admin/adm-1/import`, { method: 'POST', headers: ADMIN, body: '{"x":1}' });
    expect(bad.status).toBe(400);
  });
});

describe('joining', () => {
  it('rejects unknown worlds and old clients', async () => {
    const a = await Client.open('no-such-world');
    a.send({ t: 'hello', v: 1, name: 'Ana', pin: '1234' });
    expect((await a.next('error')).code).toBe('noworld');
    await createWorld('join-v');
    const b = await Client.open('join-v');
    b.send({ t: 'hello', v: 999, name: 'Ana', pin: '1234' });
    expect((await b.next('error')).code).toBe('version');
  });

  it('claims a name with the first PIN and checks it after', async () => {
    await createWorld('join-pin');
    const a = await Client.open('join-pin');
    expect((await a.join('Ana', '1111')).you).toBe('Ana');
    a.close();
    const b = await Client.open('join-pin');
    b.send({ t: 'hello', v: 1, name: 'Ana', pin: '2222' });
    expect((await b.next('error')).code).toBe('pin');
    const c = await Client.open('join-pin');
    expect((await c.join('Ana', '1111')).you).toBe('Ana');
  });

  it('rate-limits PIN guessing', async () => {
    await createWorld('join-rate');
    const a = await Client.open('join-rate');
    await a.join('Ana', '1111');
    const codes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c = await Client.open('join-rate');
      c.send({ t: 'hello', v: 1, name: 'Ana', pin: '9999' });
      codes.push((await c.next('error')).code);
    }
    expect(codes.slice(0, 5)).toEqual(['pin', 'pin', 'pin', 'pin', 'pin']);
    expect(codes[5]).toBe('rate');
  });
});

describe('playing', () => {
  it('two players see each other and inventory is saved', async () => {
    await createWorld('play-1');
    const a = await Client.open('play-1');
    const b = await Client.open('play-1');
    await a.join('Ana');
    await b.join('Leo');
    await sleep(250);
    a.msgs.length = 0; // drop snaps from before Leo joined
    const snap = await a.next('snap');
    expect(snap.players.map((p) => p.name)).toContain('Leo');
    a.close();
    b.close();
    await sleep(100);
    const saved = await (await exports.default.fetch(`${BASE}/admin/play-1/export`, { headers: ADMIN })).json<{ players: { name: string }[] }>();
    expect(saved.players.map((p) => p.name).sort()).toEqual(['Ana', 'Leo']);
  });

  it('drops a socket that keeps sending garbage', async () => {
    await createWorld('play-bad');
    const a = await Client.open('play-bad');
    let closed = false;
    a.ws.addEventListener('close', () => (closed = true));
    for (let i = 0; i < 25; i++) a.ws.send('garbage');
    await sleep(200);
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 3: Implement the room** — `src/server/world-room.ts`

```ts
import { DurableObject } from 'cloudflare:workers';
import { decodeClient, encode, PROTOCOL_VERSION, type ClientMsg, type ErrorCode, type ServerMsg } from '../shared/protocol';
import { MAX_ONLINE, newWorld, TICK_DT, WorldSim, type SavedWorld } from '../shared/sim/world-sim';
import { hashPin, RateLimiter } from './auth';

const SAVE_EVERY = 5; // seconds of play between saves
const MAX_MSG = 2048;
const MAX_BAD = 20;

/** One world = one instance. Owns the WorldSim, the sockets, the 10 Hz loop, and a single JSON row of storage. */
export class WorldRoom extends DurableObject<Env> {
  private sim: WorldSim | null = null;
  private readonly names = new Map<WebSocket, string>();
  private readonly bad = new Map<WebSocket, number>();
  private readonly limiter = new RateLimiter();
  private loop: ReturnType<typeof setInterval> | null = null;
  private sinceSave = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/admin/create') return this.adminCreate(request);
    if (path === '/admin/export') {
      const sim = this.load();
      return sim ? Response.json(sim.save()) : Response.json({ error: 'noworld' }, { status: 404 });
    }
    if (path === '/admin/import') return this.adminImport(request);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const msg = typeof raw === 'string' && raw.length <= MAX_MSG ? decodeClient(raw) : null;
    if (!msg) return this.strike(ws);
    const name = this.names.get(ws);
    if (!name) return msg.t === 'hello' ? this.hello(ws, msg) : this.strike(ws);
    this.sim?.handle(name, msg);
    this.flush();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.drop(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.drop(ws);
  }

  // ---------------------------------------------------------------- admin

  private async adminCreate(request: Request): Promise<Response> {
    if (this.load()) return Response.json({ error: 'exists' }, { status: 409 });
    const body = (await request.json().catch(() => ({}))) as { seed?: unknown };
    const seed = Number.isInteger(body.seed) ? (body.seed as number) : Math.floor(Math.random() * 2 ** 31);
    this.sim = new WorldSim(newWorld(seed, crypto.randomUUID()));
    this.persist();
    return Response.json({ ok: true, seed });
  }

  private async adminImport(request: Request): Promise<Response> {
    const data = (await request.json().catch(() => null)) as SavedWorld | null;
    if (!data || data.version !== 1 || !Number.isInteger(data.seed) || typeof data.salt !== 'string' || !Array.isArray(data.players) || !Array.isArray(data.structures)) {
      return Response.json({ error: 'invalid' }, { status: 400 });
    }
    for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'restore');
    this.names.clear();
    this.stopLoop(false);
    this.sim = new WorldSim(data);
    this.persist();
    return Response.json({ ok: true });
  }

  // ---------------------------------------------------------------- sessions

  private async hello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>): Promise<void> {
    const fail = (code: ErrorCode) => {
      this.send(ws, { t: 'error', code });
      ws.close(1008, code);
    };
    if (msg.v !== PROTOCOL_VERSION) return fail('version');
    const sim = this.load();
    if (!sim) return fail('noworld');
    const now = Date.now();
    if (this.limiter.blocked(msg.name, now)) return fail('rate');
    const hash = await hashPin(msg.pin, sim.salt);
    const existing = sim.getPlayer(msg.name);
    if (existing && existing.pinHash !== hash) {
      this.limiter.fail(msg.name, now);
      return fail('pin');
    }
    this.limiter.succeed(msg.name);
    if (!sim.onlineNames().includes(msg.name) && sim.activeCount() >= MAX_ONLINE) return fail('full');
    // Same name on a new device/tab replaces the old socket (phone reconnects often).
    for (const [other, n] of this.names) {
      if (n !== msg.name) continue;
      this.names.delete(other);
      other.close(4000, 'replaced');
    }
    if (!existing) sim.createPlayer(msg.name, hash);
    this.names.set(ws, msg.name);
    this.send(ws, sim.connect(msg.name));
    this.startLoop();
  }

  private drop(ws: WebSocket): void {
    const name = this.names.get(ws);
    this.names.delete(ws);
    this.bad.delete(ws);
    if (!name || !this.sim) return;
    this.sim.markAway(name);
    if (this.sim.activeCount() === 0) this.persist();
  }

  private strike(ws: WebSocket): void {
    const n = (this.bad.get(ws) ?? 0) + 1;
    this.bad.set(ws, n);
    if (n <= MAX_BAD) return;
    this.drop(ws);
    ws.close(1008, 'bad');
  }

  // ---------------------------------------------------------------- loop

  private startLoop(): void {
    if (!this.loop) this.loop = setInterval(() => this.tick(), TICK_DT * 1000);
  }

  private stopLoop(save = true): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    if (save) this.persist();
  }

  private tick(): void {
    const sim = this.sim;
    if (!sim) return this.stopLoop(false);
    sim.step(TICK_DT);
    for (const [ws, name] of this.names) {
      const snap = sim.snapshotFor(name);
      if (snap) this.send(ws, snap);
    }
    this.flush();
    this.sinceSave += TICK_DT;
    if (this.sinceSave >= SAVE_EVERY) {
      this.sinceSave = 0;
      this.persist();
    }
    // Everyone left and the away grace period ran out: stop so the object can sleep.
    if (sim.onlineNames().length === 0) this.stopLoop();
  }

  private flush(): void {
    if (!this.sim) return;
    for (const { to, msg } of this.sim.drain()) {
      for (const [ws, name] of this.names) if (to === null || to === name) this.send(ws, msg);
    }
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(encode(msg));
    } catch {
      this.drop(ws);
    }
  }

  // ---------------------------------------------------------------- storage

  private load(): WorldSim | null {
    if (this.sim) return this.sim;
    const row = this.ctx.storage.sql.exec<{ v: string }>('SELECT v FROM kv WHERE k = ?', 'world').toArray()[0];
    if (row) this.sim = new WorldSim(JSON.parse(row.v) as SavedWorld);
    return this.sim;
  }

  // ponytail: whole world as one JSON row, 1 write per 5 s. Split per section if the blob nears the 2 MB row limit.
  private persist(): void {
    if (this.sim) this.ctx.storage.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', 'world', JSON.stringify(this.sim.save()));
  }
}
```

- [ ] **Step 4: Implement the router** — `src/server/index.ts`

```ts
import { WORLD_RE } from '../shared/protocol';

export { WorldRoom } from './world-room';

const WS = /^\/ws\/([^/]+)$/;
const ADMIN = /^\/admin\/([^/]+)\/(create|export|import)$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const ws = url.pathname.match(WS);
    if (ws && WORLD_RE.test(ws[1]!)) return room(env, ws[1]!).fetch(request);
    const admin = url.pathname.match(ADMIN);
    if (admin && WORLD_RE.test(admin[1]!)) {
      if (!authorized(request, env)) return new Response('Unauthorized', { status: 401 });
      return room(env, admin[1]!).fetch(new Request(new URL(`/admin/${admin[2]}`, url), request));
    }
    if (url.pathname.startsWith('/admin/')) return new Response('Unauthorized', { status: 401 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function room(env: Env, world: string) {
  return env.WORLDS.get(env.WORLDS.idFromName(world));
}

function authorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const got = new TextEncoder().encode(request.headers.get('Authorization') ?? '');
  const want = new TextEncoder().encode(`Bearer ${env.ADMIN_TOKEN}`);
  return got.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(got, want);
}
```

- [ ] **Step 5: Generate types, build assets, run**

```bash
npx wrangler types        # writes worker-configuration.d.ts with Env { WORLDS; ASSETS; ADMIN_TOKEN }
npm run build             # dist/ must exist for the assets binding
npm run check
npm run test:workers
```
Expected: typecheck clean; room tests PASS. If `wrangler types` does not list `ADMIN_TOKEN`, confirm `.dev.vars` exists and rerun. If a test hangs, check `webSocket.accept()` was called in `Client.open` and that `run_worker_first` includes `/ws/*`.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc worker-configuration.d.ts src/server vitest.workers.config.ts test/workers
git commit -m "feat(server): Worker router and WorldRoom Durable Object with SQLite persistence"
```

---

### Task 9: Three-bot integration test (spec success test, in-process)

**Files:**
- Create: `test/workers/bots.test.ts`

**Interfaces:**
- Consumes: `Client`, `createWorld`, `sleep` (Task 8 helpers); `createTerrain`, `generateResources`, `HARVEST` (Task 2).
- Produces: nothing new. Proves: 3 clients share one world, harvest + build are broadcast, state survives everyone leaving and rejoining.

- [ ] **Step 1: Write the test** — `test/workers/bots.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createTerrain } from '../../src/shared/terrain';
import { generateResources, HARVEST, type ResourceSpawn } from '../../src/shared/resources';
import { Client, createWorld, sleep } from './helpers';

const SEED = 4242;
const terrain = createTerrain(SEED);
const trees = generateResources(terrain, SEED)
  .filter((r) => r.kind === 'tree')
  .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));

/** Walks in 1.5 m steps (under the 1.9 m/tick allowance) to 1.5 m short of the target. */
async function walkTo(c: Client, from: { x: number; z: number }, to: ResourceSpawn) {
  const pos = { ...from };
  for (;;) {
    const dx = to.x - pos.x;
    const dz = to.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= 1.5 + to.radius) return pos;
    const step = Math.min(1.5, d - 1.5 - to.radius + 0.01);
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
```

- [ ] **Step 2: Run**

Run: `npm run test:workers`
Expected: PASS (room + bots). If `place` is rejected with a toast, print `a.msgs` — most likely the wall spot is water or inside another tree; pick `pos.x - 1.5` and note it in the test.

- [ ] **Step 3: Commit**

```bash
git add test/workers/bots.test.ts
git commit -m "test(server): three-bot shared world and persistence test"
```

---

### Task 10: Client networking and interpolation

**Files:**
- Create: `src/client/net.ts`, `src/client/interp.ts`
- Test: `src/client/net.test.ts`, `src/client/interp.test.ts`

**Interfaces:**
- Consumes: `encode`, `ClientMsg`, `ServerMsg`, `ErrorCode` (Task 4).
- Produces:
  - `type NetStatus = { kind: 'connecting' } | { kind: 'online' } | { kind: 'reconnecting'; attempt: number } | { kind: 'fatal'; code: ErrorCode }`
  - `backoffMs(attempt: number): number`, `wsUrl(loc: { protocol: string; host: string }, world: string): string`
  - `class Connection { constructor(url, hello: ClientMsg, onMsg: (m: ServerMsg) => void, onStatus: (s: NetStatus) => void); send(m: ClientMsg): void; close(): void }` — `error` messages go to `onStatus` as `fatal` (no reconnect); everything else to `onMsg`
  - `interface Sample { t; x; y; z; yaw }`, `INTERP_DELAY = 0.15`, `lerpAngle(a, b, k)`, `class InterpBuffer { push(s: Sample): void; at(t: number): Sample | null }`

- [ ] **Step 1: Write failing tests**

`src/client/net.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { backoffMs, wsUrl } from './net';

describe('net helpers', () => {
  it('backs off exponentially up to 10 s', () => {
    expect([0, 1, 2, 3].map(backoffMs)).toEqual([500, 1000, 2000, 4000]);
    expect(backoffMs(20)).toBe(10_000);
  });

  it('builds ws urls on the same host', () => {
    expect(wsUrl({ protocol: 'https:', host: 'bosque.x.workers.dev' }, 'familia')).toBe('wss://bosque.x.workers.dev/ws/familia');
    expect(wsUrl({ protocol: 'http:', host: 'localhost:5173' }, 'test')).toBe('ws://localhost:5173/ws/test');
  });
});
```

`src/client/interp.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { InterpBuffer, lerpAngle } from './interp';

const s = (t: number, x: number, yaw = 0) => ({ t, x, y: 0, z: 0, yaw });

describe('InterpBuffer', () => {
  it('interpolates between samples', () => {
    const b = new InterpBuffer();
    b.push(s(1, 0));
    b.push(s(2, 10));
    expect(b.at(1.5)!.x).toBeCloseTo(5);
  });

  it('holds the ends instead of extrapolating', () => {
    const b = new InterpBuffer();
    b.push(s(1, 0));
    b.push(s(2, 10));
    expect(b.at(0)!.x).toBe(0);
    expect(b.at(5)!.x).toBe(10);
    expect(new InterpBuffer().at(1)).toBeNull();
  });

  it('ignores out-of-order samples', () => {
    const b = new InterpBuffer();
    b.push(s(2, 10));
    b.push(s(1, 0));
    expect(b.at(1)!.x).toBe(10);
  });

  it('turns the short way around', () => {
    expect(Math.abs(lerpAngle(3.1, -3.1, 0.5))).toBeGreaterThan(3.1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/client`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/client/interp.ts`:
```ts
export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Render others this far behind server time; 1.5 snapshots at 10 Hz absorbs phone jitter. */
export const INTERP_DELAY = 0.15;

export function lerpAngle(a: number, b: number, k: number): number {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * k;
}

export class InterpBuffer {
  private readonly s: Sample[] = [];

  push(x: Sample): void {
    const last = this.s[this.s.length - 1];
    if (last && x.t <= last.t) return;
    this.s.push(x);
    if (this.s.length > 20) this.s.shift();
  }

  at(t: number): Sample | null {
    const s = this.s;
    const first = s[0];
    if (!first) return null;
    if (t <= first.t) return first;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!;
      const b = s[i]!;
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / (b.t - a.t);
        return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: lerpAngle(a.yaw, b.yaw, k) };
      }
    }
    return s[s.length - 1]!;
  }
}
```

`src/client/net.ts`:
```ts
import { encode, type ClientMsg, type ErrorCode, type ServerMsg } from '../shared/protocol';

export type NetStatus =
  | { kind: 'connecting' }
  | { kind: 'online' }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'fatal'; code: ErrorCode };

export function backoffMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt);
}

export function wsUrl(loc: { protocol: string; host: string }, world: string): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws/${world}`;
}

/** One WebSocket that says hello on every (re)connect and retries with backoff until told a fatal error. */
export class Connection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private closed = false;
  private timer = 0;

  constructor(
    private readonly url: string,
    private readonly hello: ClientMsg,
    private readonly onMsg: (m: ServerMsg) => void,
    private readonly onStatus: (s: NetStatus) => void,
  ) {
    this.open();
  }

  send(m: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(m));
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.ws?.close();
  }

  private open(): void {
    this.onStatus(this.attempt === 0 ? { kind: 'connecting' } : { kind: 'reconnecting', attempt: this.attempt });
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => ws.send(encode(this.hello));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as ServerMsg;
      if (m.t === 'error') {
        this.closed = true;
        this.onStatus({ kind: 'fatal', code: m.code });
        return;
      }
      if (m.t === 'welcome') {
        this.attempt = 0;
        this.onStatus({ kind: 'online' });
      }
      this.onMsg(m);
    };
    ws.onclose = () => {
      if (this.closed || this.ws !== ws) return;
      this.attempt++;
      this.onStatus({ kind: 'reconnecting', attempt: this.attempt });
      this.timer = window.setTimeout(() => this.open(), backoffMs(this.attempt - 1));
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/net.ts src/client/net.test.ts src/client/interp.ts src/client/interp.test.ts
git commit -m "feat(client): reconnecting connection and snapshot interpolation"
```

---

### Task 11: Client movement prediction and colliders

**Files:**
- Create: `src/client/movement.ts`, `src/client/colliders.ts`
- Test: `src/client/movement.test.ts`

**Interfaces:**
- Consumes: `Terrain`, `HALF`, `WATER_LEVEL` (Task 2); `Anim` (Task 4).
- Produces:
  - `interface MoveInput { x: number; z: number; sprint: boolean; jump: boolean }` — camera-relative, `z < 0` = forward
  - `interface Body { x; y; z; vx; vz; vy; onGround: boolean; facing: number }` (`facing` uses the protocol yaw convention)
  - `interface Circle { x: number; z: number; r: number }`
  - `SPEED`, `PLAYER_RADIUS`, `createBody(x, z, terrain): Body`
  - `interface StepResult { moving; running; swimming }`
  - `stepBody(b, input, camYaw, dt, terrain, nearby: (x, z) => Circle[]): StepResult` (mutates `b`)
  - `animFor(r: StepResult, b: Body): Anim`
  - `class ColliderGrid { add(key: string, c: Circle); remove(key: string); near(x, z): Circle[] }`

- [ ] **Step 1: Write failing test** — `src/client/movement.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { HALF, WATER_LEVEL } from '../shared/terrain';
import { ColliderGrid } from './colliders';
import { animFor, createBody, PLAYER_RADIUS, SPEED, stepBody, type MoveInput } from './movement';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const none = () => [];
const fwd: MoveInput = { x: 0, z: -1, sprint: false, jump: false };

function run(input: MoveInput, seconds: number, terrain = flat, nearby: Parameters<typeof stepBody>[5] = none, yaw = 0) {
  const b = createBody(0, 0, terrain);
  let r = stepBody(b, input, yaw, 0, terrain, nearby);
  for (let t = 0; t < seconds; t += 1 / 60) r = stepBody(b, input, yaw, 1 / 60, terrain, nearby);
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/client/movement.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/client/colliders.ts`:
```ts
import type { Circle } from './movement';

/** Uniform grid of circles. Cells must be larger than (largest radius + player radius); 8 m covers rocks (~1.6 m). */
export class ColliderGrid {
  private readonly cells = new Map<string, Map<string, Circle>>();
  private readonly where = new Map<string, string>();

  constructor(private readonly size = 8) {}

  add(key: string, c: Circle): void {
    const ck = this.cell(c.x, c.z);
    let m = this.cells.get(ck);
    if (!m) this.cells.set(ck, (m = new Map()));
    m.set(key, c);
    this.where.set(key, ck);
  }

  remove(key: string): void {
    const ck = this.where.get(key);
    if (!ck) return;
    this.cells.get(ck)?.delete(key);
    this.where.delete(key);
  }

  near(x: number, z: number): Circle[] {
    const out: Circle[] = [];
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const m = this.cells.get(`${cx + dx}:${cz + dz}`);
        if (m) out.push(...m.values());
      }
    }
    return out;
  }

  private cell(x: number, z: number): string {
    return `${Math.floor(x / this.size)}:${Math.floor(z / this.size)}`;
  }
}
```

`src/client/movement.ts`:
```ts
import { HALF, WATER_LEVEL, type Terrain } from '../shared/terrain';
import type { Anim } from '../shared/protocol';

/** Camera-relative: x = strafe right, z = back (so forward is -1). Magnitude ≤ 1 after normalising. */
export interface MoveInput {
  x: number;
  z: number;
  sprint: boolean;
  jump: boolean;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  onGround: boolean;
  /** Protocol yaw: atan2(dirX, dirZ). */
  facing: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface StepResult {
  moving: boolean;
  running: boolean;
  swimming: boolean;
}

export const SPEED = { walk: 3.8, run: 7.5, swim: 2.2 } as const;
export const PLAYER_RADIUS = 0.45;
const SWIM_DEPTH = WATER_LEVEL - 0.6;
const GRAVITY = 14;
const JUMP_SPEED = 5.2;

export function createBody(x: number, z: number, terrain: Terrain): Body {
  return { x, y: Math.max(terrain.heightAt(x, z), SWIM_DEPTH), z, vx: 0, vz: 0, vy: 0, onGround: true, facing: 0 };
}

export function stepBody(b: Body, input: MoveInput, camYaw: number, dt: number, terrain: Terrain, nearby: (x: number, z: number) => Circle[]): StepResult {
  const swimming = terrain.heightAt(b.x, b.z) < SWIM_DEPTH;
  let ix = input.x;
  let iz = input.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) {
    ix /= mag;
    iz /= mag;
  }
  const moving = mag > 0.01;
  const running = input.sprint && moving && !swimming;
  const speed = swimming ? SPEED.swim : running ? SPEED.run : SPEED.walk;

  // Camera forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw).
  const s = Math.sin(camYaw);
  const c = Math.cos(camYaw);
  const wx = ix * c + iz * s;
  const wz = -ix * s + iz * c;

  const k = Math.min(1, (b.onGround ? 12 : 3) * dt);
  b.vx += (wx * speed - b.vx) * k;
  b.vz += (wz * speed - b.vz) * k;

  let nx = b.x + b.vx * dt;
  let nz = b.z + b.vz * dt;
  for (const o of nearby(nx, nz)) {
    const dx = nx - o.x;
    const dz = nz - o.z;
    const d = Math.hypot(dx, dz);
    const min = PLAYER_RADIUS + o.r;
    if (d < min && d > 1e-4) {
      const push = (min - d) / d;
      nx += dx * push;
      nz += dz * push;
    }
  }
  b.x = Math.max(-HALF + 3, Math.min(HALF - 3, nx));
  b.z = Math.max(-HALF + 3, Math.min(HALF - 3, nz));
  if (moving) b.facing = Math.atan2(wx, wz);

  const terrainH = terrain.heightAt(b.x, b.z);
  if (terrainH < SWIM_DEPTH) {
    b.y = WATER_LEVEL - 0.9;
    b.vy = 0;
    b.onGround = true;
    return { moving, running: false, swimming: true };
  }
  const ground = Math.max(terrainH, SWIM_DEPTH);
  if (input.jump && b.onGround) {
    b.vy = JUMP_SPEED;
    b.onGround = false;
  }
  b.vy -= GRAVITY * dt;
  const ny = b.y + b.vy * dt;
  if (ny <= ground) {
    b.y = ground;
    b.vy = 0;
    b.onGround = true;
  } else if (b.onGround && b.vy <= 0 && ny - ground < 0.3) {
    b.y = ground; // walking downhill: stick to the slope instead of hopping
    b.vy = 0;
  } else {
    b.y = ny;
    b.onGround = false;
  }
  return { moving, running, swimming: false };
}

export function animFor(r: StepResult, b: Body): Anim {
  if (r.swimming) return 'swim';
  if (!b.onGround) return 'jump';
  if (!r.moving) return 'idle';
  return r.running ? 'run' : 'walk';
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/movement.ts src/client/colliders.ts src/client/movement.test.ts
git commit -m "feat(client): predicted third-person movement with collisions"
```

---

### Task 12: Quality tiers and the world scene

**Files:**
- Create: `src/client/quality.ts`, `src/client/scene/terrain-mesh.ts`, `src/client/scene/vegetation.ts`, `src/client/scene/sky.ts`, `src/client/scene/structures.ts`
- Test: `src/client/quality.test.ts`

**Interfaces:**
- Consumes: `Terrain`, `WORLD_SIZE`, `WATER_LEVEL` (Task 2); `ResourceSpawn` (Task 2); `Structure` (Task 4); `createRng` (Task 1); `Circle` (Task 11).
- Produces:
  - `type Tier = 'low' | 'medium' | 'high'`, `interface TierSettings { pixelRatio; shadows; shadowMap; grass; drawDistance; terrainSegments }`, `TIERS`, `pickTier(d: { touch: boolean; memoryGb?: number; cores?: number; gpu?: string }): Tier`, `loadTier(): Tier`, `saveTier(t: Tier): void`
  - `buildTerrainMesh(terrain, segments): THREE.Mesh`, `buildWater(): THREE.Mesh`
  - `class ResourceMeshes { readonly group: THREE.Group; constructor(spawns: ResourceSpawn[], shadows: boolean); setGone(id: number, gone: boolean): void }`, `buildGrass(terrain, count, seed): THREE.InstancedMesh`
  - `class DayLight { constructor(scene: THREE.Scene, tier: TierSettings); update(dayFraction: number, focus: THREE.Vector3): void }`
  - `class StructureMeshes { readonly group: THREE.Group; has(id): boolean; add(s: Structure): Circle[]; animate(t: number): void }`

- [ ] **Step 1: Write failing test** — `src/client/quality.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { pickTier } from './quality';

describe('pickTier', () => {
  it('keeps most phones on low', () => {
    expect(pickTier({ touch: true })).toBe('low');
    expect(pickTier({ touch: true, memoryGb: 4, cores: 8 })).toBe('low');
  });

  it('lets strong phones/tablets use medium', () => {
    expect(pickTier({ touch: true, memoryGb: 8, cores: 8 })).toBe('medium');
  });

  it('gives integrated GPUs medium and real GPUs high', () => {
    expect(pickTier({ touch: false, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620)' })).toBe('medium');
    expect(pickTier({ touch: false, gpu: 'ANGLE (NVIDIA, GeForce RTX 3060)' })).toBe('high');
    expect(pickTier({ touch: false })).toBe('high');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/client/quality.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement quality** — `src/client/quality.ts`

```ts
export type Tier = 'low' | 'medium' | 'high';

export interface TierSettings {
  pixelRatio: number;
  shadows: boolean;
  shadowMap: number;
  grass: number;
  drawDistance: number;
  terrainSegments: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  low: { pixelRatio: 1, shadows: false, shadowMap: 0, grass: 2500, drawDistance: 120, terrainSegments: 160 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMap: 1024, grass: 6000, drawDistance: 180, terrainSegments: 200 },
  high: { pixelRatio: 2, shadows: true, shadowMap: 2048, grass: 12000, drawDistance: 260, terrainSegments: 240 },
};

export const TIER_LABELS: Record<Tier, string> = { low: 'Baja (móvil)', medium: 'Media', high: 'Alta (PC)' };

// ponytail: heuristic from device hints; the player can override in the menu. Replace with a quick FPS probe if it guesses wrong often.
export function pickTier(d: { touch: boolean; memoryGb?: number; cores?: number; gpu?: string }): Tier {
  if (d.touch) return (d.memoryGb ?? 4) >= 6 && (d.cores ?? 4) >= 8 ? 'medium' : 'low';
  if (/intel|mali|adreno|powervr|swiftshader/i.test(d.gpu ?? '')) return 'medium';
  return 'high';
}

const KEY = 'bosque.tier';

function detectGpu(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

export function loadTier(): Tier {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    // storage blocked: fall through to detection
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return pickTier({
    touch: matchMedia('(pointer: coarse)').matches,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    gpu: detectGpu(),
  });
}

export function saveTier(t: Tier): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Implement the scene modules**

`src/client/scene/terrain-mesh.ts`:
```ts
import * as THREE from 'three';
import { WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';

export function buildTerrainMesh(terrain: Terrain, segments: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x4f7a3a);
  const dark = new THREE.Color(0x2f5a2a);
  const dirt = new THREE.Color(0x6b5a3e);
  const rock = new THREE.Color(0x7d7f7a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    tmp.copy(grass).lerp(dark, terrain.density(x, z));
    if (h < -3) tmp.lerp(dirt, Math.min(1, (-3 - h) / 4));
    if (h > 14) tmp.lerp(rock, Math.min(1, (h - 14) / 10));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 }));
  water.position.y = WATER_LEVEL;
  return water;
}
```

`src/client/scene/vegetation.ts`:
```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '../../shared/rng';
import { HALF, WATER_LEVEL, type Terrain } from '../../shared/terrain';
import type { ResourceSpawn } from '../../shared/resources';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

interface Slot {
  meshes: THREE.InstancedMesh[];
  index: number;
  matrix: THREE.Matrix4;
}

/** Instanced trees, rocks and berry bushes; a depleted resource is hidden by zero-scaling its instance. */
export class ResourceMeshes {
  readonly group = new THREE.Group();
  private readonly slots: Slot[] = [];

  constructor(spawns: ResourceSpawn[], shadows: boolean) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.5, 7).translate(0, 2.25, 0);
    const crownGeo = new THREE.ConeGeometry(2.1, 6.5, 8).translate(0, 7, 0);
    const crown2Geo = new THREE.ConeGeometry(1.5, 4.5, 8).translate(0, 10.2, 0);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const bushGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const berryGeo = mergeGeometries(
      [[0.7, 0.3, 0.2], [-0.5, 0.5, 0.4], [0.1, 0.2, -0.75], [-0.3, -0.1, -0.6]].map(([x, y, z]) =>
        new THREE.SphereGeometry(0.12, 5, 5).translate(x!, y!, z!),
      ),
    );

    const count = (k: ResourceSpawn['kind']) => spawns.filter((s) => s.kind === k).length;
    const make = (geo: THREE.BufferGeometry, color: number, n: number, flat = false) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: flat }), n);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.frustumCulled = false; // ponytail: instances span the whole map; chunk per region if GPU-bound on phones
      this.group.add(m);
      return m;
    };
    const tree = [make(trunkGeo, 0x5b3f26, count('tree')), make(crownGeo, 0x2e6b33, count('tree')), make(crown2Geo, 0x3a7d3d, count('tree'))];
    const rock = [make(rockGeo, 0x8a8c86, count('rock'), true)];
    const bush = [make(bushGeo, 0x3f8a3a, count('bush')), make(berryGeo, 0xd2342b, count('bush'))];

    const next = { tree: 0, rock: 0, bush: 0 };
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of spawns) {
      const m = new THREE.Matrix4();
      const scale = new THREE.Vector3(s.scale, s.scale, s.scale);
      const p = new THREE.Vector3(s.x, s.y, s.z);
      q.setFromAxisAngle(up, s.rot);
      if (s.kind === 'tree') p.y -= 0.2;
      if (s.kind === 'rock') {
        p.y += 0.15 * s.scale;
        scale.set(s.scale * 1.2, s.scale * 0.8, s.scale);
      }
      if (s.kind === 'bush') {
        p.y += 0.5 * s.scale;
        scale.set(s.scale, s.scale * 0.85, s.scale);
      }
      m.compose(p, q, scale);
      const meshes = s.kind === 'tree' ? tree : s.kind === 'rock' ? rock : bush;
      const index = next[s.kind]++;
      for (const mesh of meshes) mesh.setMatrixAt(index, m);
      this.slots[s.id] = { meshes, index, matrix: m };
    }
    for (const mesh of this.group.children as THREE.InstancedMesh[]) mesh.instanceMatrix.needsUpdate = true;
  }

  setGone(id: number, gone: boolean): void {
    const slot = this.slots[id];
    if (!slot) return;
    for (const mesh of slot.meshes) {
      mesh.setMatrixAt(slot.index, gone ? ZERO : slot.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Decorative grass tufts (not harvestable). Wind sway and density shaders come in sub-project #2. */
export function buildGrass(terrain: Terrain, count: number, seed: number): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.25, 0.9, 3).translate(0, 0.45, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x7fae4a, side: THREE.DoubleSide }), count);
  const rng = createRng(seed ^ 0x6a55);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; tries < count * 4 && n < count; tries++) {
    const x = (rng() * 2 - 1) * (HALF - 6);
    const z = (rng() * 2 - 1) * (HALF - 6);
    const h = terrain.heightAt(x, z);
    if (h < WATER_LEVEL + 0.2 || terrain.density(x, z) > 0.55) continue;
    const s = 0.7 + rng() * 0.8;
    q.setFromAxisAngle(up, rng() * Math.PI);
    m.compose(new THREE.Vector3(x, h - 0.05, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.frustumCulled = false;
  return mesh;
}
```

`src/client/scene/sky.ts`:
```ts
import * as THREE from 'three';
import type { TierSettings } from '../quality';

const DAY = new THREE.Color(0xa8c8d8);
const NIGHT = new THREE.Color(0x0b1220);
const DUSK = new THREE.Color(0xd9865a);

/** Sun, moon, hemisphere light and fog driven by the shared day clock (0 = midnight). */
export class DayLight {
  private readonly sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  private readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.25);
  private readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3b5a2a, 0.6);
  private readonly fog: THREE.Fog;
  private readonly bg = new THREE.Color();

  constructor(scene: THREE.Scene, private readonly tier: TierSettings) {
    this.fog = new THREE.Fog(DAY, 25, tier.drawDistance * 0.8);
    scene.fog = this.fog;
    scene.background = this.bg;
    if (tier.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -50;
      cam.right = cam.top = 50;
      cam.near = 1;
      cam.far = 300;
      this.sun.shadow.bias = -0.0015;
    }
    scene.add(this.sun, this.sun.target, this.moon, this.hemi);
  }

  update(f: number, focus: THREE.Vector3): void {
    const angle = (f - 0.25) * Math.PI * 2; // sunrise at 0.25
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(focus.x + sunX * 120, focus.y + sunY * 120, focus.z + 40);
    this.sun.target.position.copy(focus);
    this.moon.position.set(focus.x - sunX * 120, focus.y - sunY * 120, focus.z - 40);

    const daylight = Math.max(0, Math.min(1, (sunY + 0.15) / 0.5));
    this.sun.intensity = 2.4 * daylight;
    this.moon.intensity = 0.3 * (1 - daylight);
    this.hemi.intensity = 0.15 + 0.6 * daylight;
    this.sun.color.set(daylight > 0.6 ? 0xfff2d8 : 0xffb070);

    const dusk = 1 - Math.abs(sunY) > 0.85 && sunY > -0.2 ? 1 - Math.abs(sunY) - 0.85 : 0;
    this.bg.copy(NIGHT).lerp(DAY, daylight).lerp(DUSK, Math.min(1, dusk * 4) * 0.6);
    this.fog.color.copy(this.bg);
    this.fog.near = 20 + 20 * daylight;
    this.fog.far = Math.min(this.tier.drawDistance * 0.8, 60 + 100 * daylight);
  }
}
```

`src/client/scene/structures.ts`:
```ts
import * as THREE from 'three';
import type { Structure } from '../../shared/protocol';
import type { Circle } from '../movement';

const WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
const STONE = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040 });
// ponytail: one point light per fire, capped. Past the cap fires glow without lighting; a light pool comes with #2's night work.
const MAX_FIRE_LIGHTS = 8;

export class StructureMeshes {
  readonly group = new THREE.Group();
  private readonly byId = new Map<number, THREE.Object3D>();
  private readonly fires: { flame: THREE.Mesh; light: THREE.PointLight | null; seed: number }[] = [];

  has(id: number): boolean {
    return this.byId.has(id);
  }

  /** Adds the mesh and returns collision circles for it. */
  add(s: Structure): Circle[] {
    const obj = s.kind === 'campfire' ? this.campfire(s) : this.wall();
    obj.position.set(s.x, s.y, s.z);
    obj.rotation.y = s.rot;
    this.group.add(obj);
    this.byId.set(s.id, obj);
    if (s.kind === 'campfire') return [{ x: s.x, z: s.z, r: 0.6 }];
    // A 3 m wall along its local X axis, approximated by three circles.
    return [-1, 0, 1].map((o) => ({ x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o, r: 0.55 }));
  }

  animate(t: number): void {
    for (const f of this.fires) {
      const k = 0.9 + Math.sin(t * 13 + f.seed) * 0.12 + Math.sin(t * 7.3) * 0.08;
      f.flame.scale.set(k, 0.8 + Math.sin(t * 9.1 + f.seed) * 0.2, k);
      if (f.light) f.light.intensity = 28 + Math.sin(t * 17 + f.seed) * 3;
    }
  }

  private campfire(s: Structure): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), STONE);
      stone.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      g.add(stone);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), WOOD);
      log.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI * 2, 0);
      log.position.y = 0.2;
      g.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 7), FLAME);
    flame.position.y = 0.45;
    g.add(flame);
    let light: THREE.PointLight | null = null;
    if (this.fires.filter((f) => f.light).length < MAX_FIRE_LIGHTS) {
      light = new THREE.PointLight(0xff8a3c, 28, 14, 1.6);
      light.position.y = 1;
      g.add(light);
    }
    this.fires.push({ flame, light, seed: s.x });
    return g;
  }

  private wall(): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.3), WOOD);
    m.geometry.translate(0, 1, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/client && npx tsc --noEmit`
Expected: PASS, no type errors. (Visual check happens in Task 14 once the game boots.)

- [ ] **Step 6: Commit**

```bash
git add src/client/quality.ts src/client/quality.test.ts src/client/scene
git commit -m "feat(client): quality tiers, terrain, vegetation, day light and structures"
```

---

### Task 13: Characters, wolves and camera

**Files:**
- Create: `public/models/robot.glb`, `public/models/fox.glb`, `public/models/CREDITS.md`, `src/client/actors/models.ts`, `src/client/actors/actor.ts`, `src/client/camera-rig.ts`

**Interfaces:**
- Consumes: `Terrain` (Task 2).
- Produces:
  - `interface ModelKit { scene: THREE.Object3D; clips: THREE.AnimationClip[]; scale: number; yawOffset: number }`, `loadModels(): Promise<{ robot: ModelKit; fox: ModelKit }>`
  - `interface ClipDef { clip: string; speed?: number; once?: boolean }`, `PLAYER_CLIPS`, `WOLF_CLIPS`
  - `class Actor { readonly root: THREE.Group; constructor(kit, clips: Record<string, ClipDef>, label?: string); play(anim: string); setPose(x, y, z, yaw); update(dt); dispose() }`
  - `type CamMode = 'third' | 'first'`, `class CameraRig { mode; yaw; pitch; look(dx, dy); toggle(); apply(cam, target: { x; y; z }, terrain) }`

- [ ] **Step 1: Fetch the models**

```bash
mkdir -p public/models
curl -L -o public/models/robot.glb https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb
curl -L -o public/models/fox.glb https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb
ls -la public/models   # robot ≈ 450 KB, fox ≈ 160 KB
```

`public/models/CREDITS.md`:
```md
# Model credits

- **robot.glb**: "RobotExpressive" by Tomás Laulhé (Quaternius), CC0. Modified by Don McCurdy. From the three.js examples.
  Player stand-in until character customization (sub-project #4).
- **fox.glb**: "Fox". Model by PixelMannen (CC0). Rigging and animation by tomkranis (CC-BY 4.0).
  glTF conversion by @AsoboStudio and @scurest (CC-BY 4.0). From KhronosGroup glTF-Sample-Assets.
  Wolf stand-in until the drawing-to-creature pipeline (sub-project #5).
```

- [ ] **Step 2: Implement** `src/client/actors/models.ts`

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface ModelKit {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Uniform scale that makes the model `height` metres tall. */
  scale: number;
  /** Extra rotation so the model faces +Z (protocol yaw convention). Verify in the browser, Task 14 Step 5. */
  yawOffset: number;
}

async function load(url: string, height: number, yawOffset: number): Promise<ModelKit> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  return { scene: gltf.scene, clips: gltf.animations, scale: height / (box.max.y - box.min.y), yawOffset };
}

export async function loadModels(): Promise<{ robot: ModelKit; fox: ModelKit }> {
  const [robot, fox] = await Promise.all([load('/models/robot.glb', 1.8, 0), load('/models/fox.glb', 0.75, 0)]);
  return { robot, fox };
}
```

`src/client/actors/actor.ts`:
```ts
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ModelKit } from './models';

export interface ClipDef {
  clip: string;
  speed?: number;
  once?: boolean;
}

export const PLAYER_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Idle' },
  walk: { clip: 'Walking' },
  run: { clip: 'Running' },
  jump: { clip: 'Jump', once: true },
  swim: { clip: 'Walking', speed: 0.5 },
  attack: { clip: 'Punch', once: true },
  dead: { clip: 'Death', once: true },
};

export const WOLF_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Survey' },
  walk: { clip: 'Walk' },
  run: { clip: 'Run' },
  attack: { clip: 'Run', speed: 1.6 },
  dead: { clip: 'Survey', speed: 0 },
};

/** An animated, independently skinned copy of a model kit, with an optional floating name tag. */
export class Actor {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentName = '';

  constructor(kit: ModelKit, private readonly clips: Record<string, ClipDef>, label?: string) {
    const model = SkeletonUtils.clone(kit.scene);
    model.scale.setScalar(kit.scale);
    model.rotation.y = kit.yawOffset;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of kit.clips) this.actions.set(c.name, this.mixer.clipAction(c));
    if (label) this.root.add(nameTag(label));
    this.play('idle');
  }

  play(anim: string): void {
    if (anim === this.currentName) return;
    const def = this.clips[anim] ?? this.clips.idle!;
    const next = this.actions.get(def.clip);
    if (!next) return;
    this.currentName = anim;
    next.reset();
    next.setEffectiveTimeScale(def.speed ?? 1);
    next.setLoop(def.once ? THREE.LoopOnce : THREE.LoopRepeat, def.once ? 1 : Infinity);
    next.clampWhenFinished = !!def.once;
    next.play();
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, 0.2, false);
    this.current = next;
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}

function nameTag(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 32);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.25;
  return sprite;
}
```

`src/client/camera-rig.ts`:
```ts
import type * as THREE from 'three';
import type { Terrain } from '../shared/terrain';

export type CamMode = 'third' | 'first';

/** Over-the-shoulder orbit camera with a first-person toggle. yaw 0 looks toward -Z, matching movement. */
export class CameraRig {
  mode: CamMode = 'third';
  yaw = 0;
  pitch = -0.25;
  private readonly dist = 4.5;

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0022;
    const maxUp = this.mode === 'first' ? 1.45 : 0.6;
    this.pitch = Math.max(-1.2, Math.min(maxUp, this.pitch - dy * 0.0022));
  }

  toggle(): void {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.pitch = Math.min(this.pitch, 0.6);
  }

  apply(cam: THREE.PerspectiveCamera, target: { x: number; y: number; z: number }, terrain: Terrain): void {
    if (this.mode === 'first') {
      cam.position.set(target.x, target.y + 1.7, target.z);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    const eyeY = target.y + 1.6;
    const cp = Math.cos(this.pitch);
    const x = target.x + Math.sin(this.yaw) * cp * this.dist;
    const z = target.z + Math.cos(this.yaw) * cp * this.dist;
    const y = Math.max(eyeY - Math.sin(this.pitch) * this.dist, terrain.heightAt(x, z) + 0.4);
    cam.position.set(x, y, z);
    cam.lookAt(target.x, eyeY, target.z);
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `three/addons/...` types don't resolve, confirm `@types/three` ≥ 0.185 is installed (it ships `examples/jsm` types mapped to `three/addons/*`).

- [ ] **Step 4: Commit**

```bash
git add public/models src/client/actors src/client/camera-rig.ts
git commit -m "feat(client): animated player and wolf actors, third/first-person camera"
```

---

### Task 14: Input, HUD, join screen and the game loop (replaces the old game)

**Files:**
- Create: `src/client/input.ts`, `src/client/hud.ts`, `src/client/join.ts`, `src/client/game.ts`, `src/client/main.ts`
- Move + modify: `src/ui/touch.ts` → `src/client/touch.ts`; `src/ui/style.css` → `src/client/style.css`
- Modify: `index.html`, `.claude/launch.json`
- Delete: `src/game/`, `src/ui/`, `src/main.ts`
- Test: `src/client/input.test.ts`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces:
  - `interface InputState { forward; back; left; right; sprint; jump; axis?: { x: number; z: number } }` (same shape `touch.ts` already writes), `readMove(i: InputState): MoveInput`, `type Action = 'act' | 'eat' | 'campfire' | 'wall' | 'camera' | 'menu'`, `KEY_ACTIONS`, `class Keyboard { constructor(input, onAction); dispose() }`
  - `class Hud` (see code), `interface JoinInfo { world; name; pin }`, `joinScreen(parent, onJoin)`, `class Game { constructor(root, join, onLeave); dispose() }`

- [ ] **Step 1: Write failing test** — `src/client/input.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { readMove, type InputState } from './input';

const base: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

describe('readMove', () => {
  it('maps WASD to camera-relative input', () => {
    expect(readMove({ ...base, forward: true })).toEqual({ x: 0, z: -1, sprint: false, jump: false });
    expect(readMove({ ...base, right: true, back: true, sprint: true })).toEqual({ x: 1, z: 1, sprint: true, jump: false });
  });

  it('prefers the analog stick', () => {
    expect(readMove({ ...base, forward: true, axis: { x: 0.3, z: -0.5 } })).toEqual({ x: 0.3, z: -0.5, sprint: false, jump: false });
  });
});
```

Run: `npx vitest run src/client/input.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement input** — `src/client/input.ts`

```ts
import type { MoveInput } from './movement';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  /** Touch stick: x = strafe, z = forward(-)/back(+), magnitude ≤ 1. */
  axis?: { x: number; z: number };
}

export function readMove(i: InputState): MoveInput {
  if (i.axis) return { x: i.axis.x, z: i.axis.z, sprint: i.sprint, jump: i.jump };
  return { x: (i.right ? 1 : 0) - (i.left ? 1 : 0), z: (i.back ? 1 : 0) - (i.forward ? 1 : 0), sprint: i.sprint, jump: i.jump };
}

export type Action = 'act' | 'eat' | 'campfire' | 'wall' | 'camera' | 'menu';

/** Also used by touch buttons, which fire these KeyboardEvent codes. */
export const KEY_ACTIONS: Record<string, Action> = {
  KeyE: 'act',
  KeyF: 'act',
  Digit1: 'eat',
  KeyB: 'campfire',
  KeyV: 'wall',
  KeyC: 'camera',
  Escape: 'menu',
};

const HOLD: Record<string, keyof Omit<InputState, 'axis'>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
};

export class Keyboard {
  constructor(private readonly input: InputState, private readonly onAction: (a: Action) => void) {
    addEventListener('keydown', this.down);
    addEventListener('keyup', this.up);
    addEventListener('blur', this.clear);
  }

  dispose(): void {
    removeEventListener('keydown', this.down);
    removeEventListener('keyup', this.up);
    removeEventListener('blur', this.clear);
  }

  private down = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    const hold = HOLD[e.code];
    if (hold) {
      this.input[hold] = true;
      e.preventDefault();
      return;
    }
    const action = KEY_ACTIONS[e.code];
    if (action && !e.repeat) this.onAction(action);
  };

  private up = (e: KeyboardEvent): void => {
    const hold = HOLD[e.code];
    if (hold) this.input[hold] = false;
  };

  private clear = (): void => {
    for (const k of Object.values(HOLD)) this.input[k] = false;
  };
}
```

Run: `npx vitest run src/client/input.test.ts` → PASS.

- [ ] **Step 3: Move and adapt touch controls and CSS**

```bash
git mv src/ui/touch.ts src/client/touch.ts
git mv src/ui/style.css src/client/style.css
sed -i "s#import type { InputState } from '../game/player';#import type { InputState } from './input';#" src/client/touch.ts
```

In `src/client/touch.ts`, replace the `ACTION_BUTTONS` and `PILL_BUTTONS` constants with:
```ts
const ACTION_BUTTONS: ButtonDef[] = [
  { code: 'KeyE', label: 'A', sub: 'acción', cls: 'btn-a' },
  { code: 'Space', label: 'B', sub: 'saltar', cls: 'btn-b', hold: 'jump' },
];

const PILL_BUTTONS: ButtonDef[] = [
  { code: 'Digit1', label: '🫐', sub: 'comer', cls: 'pill' },
  { code: 'KeyB', label: '🔥', sub: 'fogata', cls: 'pill' },
  { code: 'KeyV', label: '🧱', sub: 'muro', cls: 'pill' },
  { code: 'KeyC', label: '🎥', sub: 'cámara', cls: 'pill' },
];
```
and in the constructor replace the block that builds `system` (from `const system = div('touch-system');` through `system.appendChild(pause);`) with:
```ts
    const system = div('touch-system');
    const menu = this.button({ code: '', label: 'MENÚ', cls: 'sys' });
    menu.addEventListener('pointerup', (e) => {
      e.preventDefault();
      h.onPause();
    });
    system.appendChild(menu);
```

Append to `src/client/style.css`:
```css
.banner { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); background: var(--bg); padding: 6px 14px; border-radius: 16px; font-size: 14px; z-index: 5; }
.banner[hidden] { display: none; }
.prompt-line { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); background: var(--bg); padding: 6px 12px; border-radius: 8px; font-size: 14px; }
.prompt-line[hidden] { display: none; }
.panel label { display: block; margin: 12px 0 4px; font-size: 13px; color: var(--muted); }
.panel input, .panel select { width: 100%; padding: 10px; font-size: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: var(--fg); }
.panel .err { color: var(--health); min-height: 1.2em; margin-top: 8px; }
.inventory-line { position: absolute; top: 12px; right: 12px; background: var(--bg); padding: 6px 12px; border-radius: 8px; font-size: 14px; }
```
(16 px inputs stop iOS Safari from zooming on focus.)

- [ ] **Step 4: Implement HUD, join screen, game and entry**

`src/client/hud.ts`:
```ts
import { ITEM_LABELS, ITEMS, type Inventory } from '../shared/items';
import type { ErrorCode } from '../shared/protocol';
import type { Vitals } from '../shared/survival';
import type { NetStatus } from './net';
import { TIER_LABELS, type Tier } from './quality';

const FATAL: Record<ErrorCode, string> = {
  version: 'Hay una versión nueva del juego.',
  pin: 'PIN incorrecto para ese nombre.',
  rate: 'Demasiados intentos. Espera unos minutos.',
  noworld: 'Ese mundo no existe. Revisa el código.',
  full: 'El mundo está lleno.',
  bad: 'Error de conexión.',
};

export class Hud {
  readonly root = document.createElement('div');
  private readonly bars: Record<keyof Vitals, HTMLElement> = {} as Record<keyof Vitals, HTMLElement>;
  private readonly inv = el('div', 'inventory-line');
  private readonly log = el('div', 'log');
  private readonly banner = el('div', 'banner');
  private readonly prompt = el('div', 'prompt-line');
  private readonly overlay = el('div', 'overlay');
  menuOpen = false;

  constructor(parent: HTMLElement) {
    this.root.className = 'hud';
    const stats = el('div', 'stats');
    for (const [key, icon, color] of [['health', '❤️', 'var(--health)'], ['hunger', '🍖', 'var(--hunger)'], ['warmth', '🔥', 'var(--warmth)']] as const) {
      const row = el('div', 'stat');
      row.innerHTML = `<span>${icon}</span><div class="bar"><i style="background:${color}"></i></div><span class="val"></span>`;
      stats.appendChild(row);
      this.bars[key] = row;
    }
    this.banner.hidden = true;
    this.prompt.hidden = true;
    this.overlay.hidden = true;
    this.root.append(stats, this.inv, this.log, this.banner, this.prompt);
    parent.append(this.root, this.overlay);
  }

  setVitals(v: Vitals): void {
    for (const k of Object.keys(this.bars) as (keyof Vitals)[]) {
      const row = this.bars[k];
      (row.querySelector('i') as HTMLElement).style.width = `${v[k]}%`;
      (row.querySelector('.val') as HTMLElement).textContent = String(v[k]);
      row.classList.toggle('low', v[k] < 25);
    }
  }

  setInventory(inv: Inventory): void {
    const parts = ITEMS.filter((i) => (inv[i] ?? 0) > 0).map((i) => `${ITEM_LABELS[i]} ${inv[i]}`);
    this.inv.textContent = parts.length ? parts.join(' · ') : 'Mochila vacía';
  }

  toast(text: string): void {
    const d = el('div', '');
    d.textContent = text;
    this.log.prepend(d);
    setTimeout(() => d.remove(), 6000);
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = !text;
    this.prompt.textContent = text ?? '';
  }

  setStatus(s: NetStatus, onRetry: () => void): void {
    this.banner.hidden = s.kind === 'online';
    if (s.kind === 'connecting') this.banner.textContent = 'Conectando…';
    if (s.kind === 'reconnecting') this.banner.textContent = 'Reconectando…';
    if (s.kind !== 'fatal') return;
    this.banner.hidden = true;
    const again = s.code === 'version' ? 'Actualizar' : 'Volver';
    this.panel(`<h2>No se pudo entrar</h2><p>${FATAL[s.code]}</p><button data-a="retry">${again}</button>`, {
      retry: () => (s.code === 'version' ? location.reload() : onRetry()),
    });
  }

  showDeath(onRespawn: () => void): void {
    this.panel('<h2>Has caído</h2><p>Conservas tu mochila.</p><button data-a="respawn">Reaparecer</button>', { respawn: onRespawn });
  }

  showMenu(tier: Tier, h: { onTier: (t: Tier) => void; onCamera: () => void; onLeave: () => void }): void {
    const options = (Object.keys(TIER_LABELS) as Tier[])
      .map((t) => `<option value="${t}" ${t === tier ? 'selected' : ''}>${TIER_LABELS[t]}</option>`)
      .join('');
    this.panel(
      `<h2>Menú</h2>
       <label>Calidad gráfica</label><select data-f="tier">${options}</select>
       <button data-a="resume">Seguir jugando</button>
       <button class="secondary" data-a="camera">Cambiar cámara</button>
       <button class="secondary" data-a="leave">Salir</button>`,
      { resume: () => this.hideOverlay(), camera: () => { h.onCamera(); this.hideOverlay(); }, leave: h.onLeave },
    );
    this.menuOpen = true;
    this.overlay.querySelector('select')!.addEventListener('change', (e) => h.onTier((e.target as HTMLSelectElement).value as Tier));
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.menuOpen = false;
  }

  private panel(html: string, actions: Record<string, () => void>): void {
    this.overlay.innerHTML = `<div class="panel">${html}</div>`;
    this.overlay.hidden = false;
    for (const b of this.overlay.querySelectorAll<HTMLElement>('[data-a]')) {
      b.addEventListener('click', () => actions[b.dataset.a!]?.());
    }
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
```
(Hud text never includes player-controlled strings except via `textContent`, so no HTML injection.)

`src/client/join.ts`:
```ts
import { NAME_RE, PIN_RE, WORLD_RE } from '../shared/protocol';

export interface JoinInfo {
  world: string;
  name: string;
  pin: string;
}

const KEY = 'bosque.join';

export function joinScreen(parent: HTMLElement, onJoin: (j: JoinInfo) => void): void {
  let saved: Partial<JoinInfo> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<JoinInfo>;
  } catch {
    // ignore
  }
  const world = new URLSearchParams(location.search).get('mundo') ?? saved.world ?? '';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <form class="panel">
      <h1>Bosque</h1>
      <p>Entra al mundo de tu familia. Tu progreso se guarda en el servidor.</p>
      <label for="j-world">Código del mundo</label>
      <input id="j-world" autocapitalize="off" autocomplete="off" spellcheck="false" />
      <label for="j-name">Tu nombre</label>
      <input id="j-name" maxlength="16" autocomplete="nickname" />
      <label for="j-pin">PIN (4 números)</label>
      <input id="j-pin" inputmode="numeric" maxlength="4" type="password" autocomplete="off" />
      <div class="err"></div>
      <button type="submit">Entrar</button>
    </form>`;
  const $ = (id: string) => overlay.querySelector<HTMLInputElement>(id)!;
  $('#j-world').value = world;
  $('#j-name').value = saved.name ?? '';
  $('#j-pin').value = saved.pin ?? '';
  overlay.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const j: JoinInfo = { world: $('#j-world').value.trim().toLowerCase(), name: $('#j-name').value.trim(), pin: $('#j-pin').value.trim() };
    const err = overlay.querySelector('.err')!;
    if (!WORLD_RE.test(j.world)) return void (err.textContent = 'El código del mundo usa letras, números y guiones.');
    if (!NAME_RE.test(j.name)) return void (err.textContent = 'El nombre tiene de 1 a 16 letras o números.');
    if (!PIN_RE.test(j.pin)) return void (err.textContent = 'El PIN son 4 números.');
    try {
      // ponytail: PIN remembered on this device for the kids' convenience; it only guards a family game.
      localStorage.setItem(KEY, JSON.stringify(j));
    } catch {
      // ignore
    }
    overlay.remove();
    onJoin(j);
  });
  parent.appendChild(overlay);
}
```

`src/client/game.ts`:
```ts
import * as THREE from 'three';
import { HARVEST, generateResources, type ResourceSpawn } from '../shared/resources';
import { createTerrain, type Terrain } from '../shared/terrain';
import { PROTOCOL_VERSION, r2, type Anim, type ServerMsg, type Structure } from '../shared/protocol';
import { dayFraction, PUNCH, REACH } from '../shared/sim/world-sim';
import type { StructureKind } from '../shared/items';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import { loadModels, type ModelKit } from './actors/models';
import { CameraRig } from './camera-rig';
import { ColliderGrid } from './colliders';
import { Hud } from './hud';
import { Keyboard, readMove, type Action, type InputState, KEY_ACTIONS } from './input';
import { InterpBuffer, INTERP_DELAY } from './interp';
import type { JoinInfo } from './join';
import { animFor, createBody, stepBody, type Body } from './movement';
import { Connection, wsUrl, type NetStatus } from './net';
import { loadTier, saveTier, TIERS, type Tier } from './quality';
import { DayLight } from './scene/sky';
import { StructureMeshes } from './scene/structures';
import { buildTerrainMesh, buildWater } from './scene/terrain-mesh';
import { buildGrass, ResourceMeshes } from './scene/vegetation';
import { TouchControls, isTouchDevice } from './touch';

interface Remote {
  actor: Actor;
  buf: InterpBuffer;
  anim: string;
  seen: number;
}

const IDLE_INPUT = { x: 0, z: 0, sprint: false, jump: false };

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig = new CameraRig();
  private readonly input: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };
  private readonly hud: Hud;
  private readonly conn: Connection;
  private readonly keyboard: Keyboard;
  private readonly touch: TouchControls | null;
  private readonly tier: Tier = loadTier();
  private readonly timer = new THREE.Timer();
  private readonly colliders = new ColliderGrid();
  private readonly structures = new StructureMeshes();
  private readonly others = new Map<string, Remote>();
  private readonly wolves = new Map<number, Remote>();
  private readonly gone = new Set<number>();
  private light: DayLight;
  private kits: { robot: ModelKit; fox: ModelKit } | null = null;
  private seed: number | null = null;
  private terrain: Terrain | null = null;
  private spawns: ResourceSpawn[] = [];
  private resMeshes: ResourceMeshes | null = null;
  private body: Body | null = null;
  private me: Actor | null = null;
  private myName = '';
  private serverTime = 0;
  private dead = false;
  private attackUntil = 0;
  private sendTimer = 0;
  private lastSent = '';

  constructor(private readonly root: HTMLElement, join: JoinInfo, private readonly onLeave: () => void) {
    const t = TIERS[this.tier];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.tier !== 'low' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, t.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = t.shadows;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    root.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, t.drawDistance);
    this.light = new DayLight(this.scene, t);
    this.scene.add(this.structures.group);

    this.hud = new Hud(root);
    this.keyboard = new Keyboard(this.input, (a) => this.onAction(a));
    this.touch = isTouchDevice()
      ? new TouchControls(root, this.input, {
          onLook: (dx, dy) => this.rig.look(dx, dy),
          onAction: (code) => {
            const a = KEY_ACTIONS[code];
            if (a) this.onAction(a);
          },
          onPause: () => this.onAction('menu'),
        })
      : null;
    root.classList.toggle('touch', !!this.touch);
    if (!this.touch) {
      this.renderer.domElement.addEventListener('click', this.onClick);
      document.addEventListener('mousemove', this.onMouse);
    }
    addEventListener('resize', this.onResize);

    this.conn = new Connection(
      wsUrl(location, join.world),
      { t: 'hello', v: PROTOCOL_VERSION, name: join.name, pin: join.pin },
      (m) => this.onMsg(m),
      (s) => this.onStatus(s),
    );
    loadModels()
      .then((k) => (this.kits = k))
      .catch(() => this.hud.toast('No se pudieron cargar los personajes'));
    this.renderer.setAnimationLoop(() => this.frame());
  }

  dispose(): void {
    this.conn.close();
    this.renderer.setAnimationLoop(null);
    this.keyboard.dispose();
    this.touch?.dispose();
    document.removeEventListener('mousemove', this.onMouse);
    removeEventListener('resize', this.onResize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    this.root.innerHTML = '';
  }

  // ---------------------------------------------------------------- network

  private onStatus(s: NetStatus): void {
    this.hud.setStatus(s, () => this.onLeave());
  }

  private onMsg(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome':
        return this.onWelcome(m);
      case 'snap':
        return this.onSnap(m);
      case 'res':
        return this.setGone(m.id, m.gone);
      case 'built':
        return this.addStructure(m.s);
      case 'toast':
        return this.hud.toast(m.text);
      case 'error':
        return; // handled by Connection → onStatus
    }
  }

  private onWelcome(m: Extract<ServerMsg, { t: 'welcome' }>): void {
    this.myName = m.you;
    if (this.seed !== m.seed) this.buildWorld(m.seed);
    const gone = new Set(m.gone);
    for (const s of this.spawns) this.setGone(s.id, gone.has(s.id));
    for (const s of m.structures) this.addStructure(s);
    this.body = createBody(m.self.x, m.self.z, this.terrain!);
    this.body.y = m.self.y;
    this.serverTime = m.time;
    this.applySelf(m.self);
  }

  private buildWorld(seed: number): void {
    const t = TIERS[this.tier];
    this.seed = seed;
    this.terrain = createTerrain(seed);
    this.spawns = generateResources(this.terrain, seed);
    this.resMeshes = new ResourceMeshes(this.spawns, t.shadows);
    this.scene.add(buildTerrainMesh(this.terrain, t.terrainSegments), buildWater(), buildGrass(this.terrain, t.grass, seed), this.resMeshes.group);
    for (const s of this.spawns) if (s.kind !== 'bush') this.colliders.add(`r${s.id}`, { x: s.x, z: s.z, r: s.radius });
  }

  private setGone(id: number, gone: boolean): void {
    const s = this.spawns[id];
    if (!s || this.gone.has(id) === gone) return;
    if (gone) this.gone.add(id);
    else this.gone.delete(id);
    this.resMeshes?.setGone(id, gone);
    if (s.kind === 'bush') return;
    if (gone) this.colliders.remove(`r${id}`);
    else this.colliders.add(`r${id}`, { x: s.x, z: s.z, r: s.radius });
  }

  private addStructure(s: Structure): void {
    if (this.structures.has(s.id)) return;
    this.structures.add(s).forEach((c, i) => this.colliders.add(`s${s.id}:${i}`, c));
  }

  private onSnap(m: Extract<ServerMsg, { t: 'snap' }>): void {
    this.serverTime = m.time;
    this.applySelf(m.self);
    if (!this.kits) return;
    for (const p of m.players) {
      const r = this.remote(this.others, p.name, () => new Actor(this.kits!.robot, PLAYER_CLIPS, p.name));
      r.buf.push({ t: m.time, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      r.anim = p.dead ? 'dead' : p.away ? 'idle' : p.anim;
      r.seen = m.time;
    }
    for (const w of m.wolves) {
      const r = this.remote(this.wolves, w.id, () => new Actor(this.kits!.fox, WOLF_CLIPS));
      r.buf.push({ t: m.time, x: w.x, y: w.y, z: w.z, yaw: w.yaw });
      r.anim = w.anim;
      r.seen = m.time;
    }
    for (const map of [this.others, this.wolves] as Map<unknown, Remote>[]) {
      for (const [k, r] of map) {
        if (r.seen === m.time) continue;
        r.actor.dispose();
        map.delete(k);
      }
    }
  }

  private remote<K>(map: Map<K, Remote>, key: K, make: () => Actor): Remote {
    let r = map.get(key);
    if (!r) {
      r = { actor: make(), buf: new InterpBuffer(), anim: 'idle', seen: 0 };
      this.scene.add(r.actor.root);
      map.set(key, r);
    }
    return r;
  }

  private applySelf(self: Extract<ServerMsg, { t: 'snap' }>['self']): void {
    this.hud.setVitals(self.vitals);
    this.hud.setInventory(self.inv);
    if (self.fix && this.body) {
      Object.assign(this.body, { x: self.x, y: self.y, z: self.z, vx: 0, vz: 0, vy: 0 });
    }
    if (self.dead && !this.dead) this.hud.showDeath(() => {
      this.conn.send({ t: 'respawn' });
      this.hud.hideOverlay();
    });
    this.dead = self.dead;
  }

  // ---------------------------------------------------------------- actions

  private onAction(a: Action): void {
    if (a === 'menu') {
      if (this.hud.menuOpen) return this.hud.hideOverlay();
      if (document.pointerLockElement) document.exitPointerLock();
      return this.hud.showMenu(this.tier, {
        onTier: (t) => {
          saveTier(t);
          location.reload();
        },
        onCamera: () => this.rig.toggle(),
        onLeave: () => this.onLeave(),
      });
    }
    if (this.dead || !this.body || this.hud.menuOpen) return;
    if (a === 'camera') return this.rig.toggle();
    if (a === 'eat') return this.conn.send({ t: 'eat' });
    if (a === 'campfire' || a === 'wall') return this.place(a);
    this.act();
  }

  /** One button does everything: punch the nearest wolf, else gather the nearest resource. */
  private act(): void {
    const b = this.body!;
    this.attackUntil = performance.now() + 450;
    let best: { id: number; d: number } | null = null;
    for (const [id, w] of this.wolves) {
      if (w.anim === 'dead') continue;
      const p = w.actor.root.position;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d <= PUNCH.reach && (!best || d < best.d)) best = { id, d };
    }
    if (best) return this.conn.send({ t: 'attack', id: best.id });
    const res = this.nearestResource();
    if (res) this.conn.send({ t: 'harvest', id: res.id });
  }

  private nearestResource(): ResourceSpawn | null {
    const b = this.body!;
    let best: ResourceSpawn | null = null;
    let bestD = Infinity;
    for (const s of this.spawns) {
      if (this.gone.has(s.id) || Math.abs(s.x - b.x) > 6 || Math.abs(s.z - b.z) > 6) continue;
      const d = Math.hypot(s.x - b.x, s.z - b.z) - s.radius;
      if (d <= REACH && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private place(kind: StructureKind): void {
    const b = this.body!;
    const x = b.x + Math.sin(b.facing) * 2.5;
    const z = b.z + Math.cos(b.facing) * 2.5;
    this.conn.send({ t: 'place', kind, x: r2(x), z: r2(z), rot: r2(b.facing) });
  }

  // ---------------------------------------------------------------- frame

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const b = this.body;
    const terrain = this.terrain;
    if (!b || !terrain) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.serverTime += dt;

    const mv = this.dead || this.hud.menuOpen ? IDLE_INPUT : readMove(this.input);
    const res = stepBody(b, mv, this.rig.yaw, dt, terrain, (x, z) => this.colliders.near(x, z));
    let anim: Anim | 'dead' = animFor(res, b);
    if (performance.now() < this.attackUntil) anim = 'attack';
    if (this.dead) anim = 'dead';

    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && !this.dead) {
      this.sendTimer = 0.1;
      const msg = { t: 'move' as const, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.facing), anim: anim as Anim };
      const key = JSON.stringify(msg);
      // ponytail: skip unchanged moves to save free-tier requests. The 1 Hz resend keeps the server's speed check window fresh.
      if (key !== this.lastSent || Math.random() < 0.1) {
        this.conn.send(msg);
        this.lastSent = key;
      }
    }

    if (!this.me && this.kits) {
      this.me = new Actor(this.kits.robot, PLAYER_CLIPS);
      this.scene.add(this.me.root);
    }
    if (this.me) {
      this.me.setPose(b.x, b.y, b.z, b.facing);
      this.me.play(anim);
      this.me.update(dt);
      this.me.root.visible = this.rig.mode === 'third';
    }

    const rt = this.serverTime - INTERP_DELAY;
    for (const r of this.others.values()) this.animateRemote(r, rt, dt);
    for (const r of this.wolves.values()) {
      this.animateRemote(r, rt, dt);
      r.actor.root.rotation.z = r.anim === 'dead' ? Math.PI / 2 : 0; // fox has no death clip: tip it over
    }

    const focus = new THREE.Vector3(b.x, b.y, b.z);
    this.light.update(dayFraction(this.serverTime), focus);
    this.structures.animate(performance.now() / 1000);
    this.rig.apply(this.camera, b, terrain);
    this.updatePrompt();
    this.renderer.render(this.scene, this.camera);
  }

  private animateRemote(r: Remote, rt: number, dt: number): void {
    const s = r.buf.at(rt);
    if (s) r.actor.setPose(s.x, s.y, s.z, s.yaw);
    r.actor.play(r.anim);
    r.actor.update(dt);
  }

  private updatePrompt(): void {
    if (this.touch || this.dead) return this.hud.setPrompt(null);
    const res = this.nearestResource();
    this.hud.setPrompt(res ? `E · ${HARVEST[res.kind].label}` : null);
  }

  // ---------------------------------------------------------------- desktop mouse

  private onClick = (): void => {
    if (this.hud.menuOpen) return;
    if (document.pointerLockElement !== this.renderer.domElement) {
      void this.renderer.domElement.requestPointerLock();
      return;
    }
    this.onAction('act');
  };

  private onMouse = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.renderer.domElement) this.rig.look(e.movementX, e.movementY);
  };

  private onResize = (): void => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };
}
```

`src/client/main.ts`:
```ts
import './style.css';
import { Game } from './game';
import { joinScreen } from './join';

const app = document.getElementById('app')!;
let game: Game | null = null;

function start(): void {
  joinScreen(app, (j) => {
    game = new Game(app, j, () => {
      game?.dispose();
      game = null;
      start();
    });
  });
}

start();
```

`index.html`: set `<title>Bosque</title>`, delete the `<link rel="stylesheet" …>` line, and change the script to `<script type="module" src="/src/client/main.ts"></script>`.

- [ ] **Step 5: Delete the old single-player code and check**

```bash
git rm -r src/game src/ui/hud.ts src/main.ts
npx tsc --noEmit && npm test
```
Expected: typecheck clean; only new tests run and PASS. (`src/ui/` is now empty and disappears.)

- [ ] **Step 6: Run it locally and verify in the browser**

Update `.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "bosque-server", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev:server"], "port": 8787 },
    { "name": "forest-dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```
Start `bosque-server` then `forest-dev` with the preview tools, then create the local world:
```bash
curl -X POST http://127.0.0.1:8787/admin/test/create -H "Authorization: Bearer dev-admin" -d '{"seed":4242}'
```
Open `http://localhost:5173/?mundo=test` in two tabs, join as `Ana`/`1111` and `Leo`/`2222`. Verify, fixing what fails:
1. Both see terrain, trees, the robot, and each other's name tag moving smoothly.
2. **Facing:** walking forward, the robot faces away from the camera. If it walks backwards, set robot `yawOffset` to `Math.PI` in `models.ts`. Do the same check for wolves at night.
3. E / click next to a tree gathers wood; the tree disappears in both tabs after 3 hits.
4. B places a campfire (needs 5 wood + 3 stone) that shows in both tabs and lights at night; V places a wall you can't walk through.
5. C toggles first-person; Esc opens the menu; changing quality reloads.
6. Set night quickly: `curl http://127.0.0.1:8787/admin/test/export -H "Authorization: Bearer dev-admin" > w.json`, edit `"time"` to `306` (0.85 of a day), `curl -X POST .../admin/test/import -H ... --data-binary @w.json`, rejoin. Wolves appear, chase, bite; punching kills; dying shows "Has caído"; Reaparecer works and the mochila is kept.
7. Mobile: `resize_window` preset `mobile`, reload with `?touch=1`: stick, look drag, A/B and pill buttons work; no page zoom.
8. Stop `bosque-server` for 5 s and restart: banner shows "Reconectando…" and play resumes.
9. `read_console_messages` has no errors.
Screenshot desktop and mobile as proof.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(client): online third-person game loop; remove single-player code"
```

---

### Task 15: Deploy pipeline, docs and first playtest

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/ci.yml`, `README.md`
- Delete: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `npm run check | build | test | test:workers | deploy` (Task 1), admin routes (Task 8).
- Produces: push to `main` → tests → `wrangler deploy`. Rollback with `npx wrangler rollback`.

- [ ] **Step 1: CI and deploy workflows**

Replace `.github/workflows/ci.yml` steps after `npm ci` with:
```yaml
      - run: npm run build
      - run: npm run check
      - run: npm test
      - run: npm run test:workers
```

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run check
      - run: npm test
      - run: npm run test:workers
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

```bash
git rm .github/workflows/pages.yml
```
GitHub Pages keeps serving its last deployment, so the old single-player Bosque stays at `gpope777.github.io/Website-IS/`.

- [ ] **Step 2: Rewrite README.md**

Replace the file with: a short description (online co-op survival for up to 8, in Spanish), controls table (WASD/stick, mouse drag/look, Shift sprint, Space jump, E/click action, 1 eat, B campfire, V wall, C camera, Esc menu), dev commands (`npm run dev:server` + `npm run dev`, local world creation curl, `npm test`, `npm run test:workers`, `npm run check`), deploy (`npm run deploy` or push to main), admin commands (create world, export backup, import backup, with `Authorization: Bearer $ADMIN_TOKEN`), rollback (`npx wrangler rollback`), and the `src/shared | src/server | src/client` layout. Link the spec and `public/models/CREDITS.md`.

Commit:
```bash
git add -A .github README.md
git commit -m "ci: test and deploy to Cloudflare; retire GitHub Pages deploy"
```

- [ ] **Step 3: First deploy — needs Gabriel (stop and ask him)**

These steps need his account and approval; do not attempt them alone:
1. Gabriel creates a free Cloudflare account at dash.cloudflare.com.
2. On this PC: `npx wrangler login` (browser OAuth).
3. `npm run deploy`, and note the `https://bosque.<subdomain>.workers.dev` URL.
4. `npx wrangler secret put ADMIN_TOKEN` (Gabriel picks a long random value and saves it in his password manager).
5. Create worlds:
   ```bash
   curl -X POST https://bosque.<subdomain>.workers.dev/admin/test/create -H "Authorization: Bearer <ADMIN_TOKEN>"
   curl -X POST https://bosque.<subdomain>.workers.dev/admin/familia-<4 random chars>/create -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
6. For auto-deploy: Cloudflare dashboard → API token from the "Edit Cloudflare Workers" template → `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID`.
7. Open a PR `revamp/online` → `main` (merge only with Gabriel's OK).

Rollback path to report: `npx wrangler rollback` (client and server together); world data backup via `/admin/<world>/export`.

- [ ] **Step 4: Real playtest (spec success test)**

On the `test` world: Gabriel on a PC plus two phones on cellular data play 30 minutes. Check: responsive controls, chopped trees and walls match on all screens, wolves at night work, a phone that loses signal reconnects. Everyone leaves; the next day the world is unchanged. Record results and any bugs in `docs/superpowers/playtests/2026-MM-DD-foundation.md`. Then share the family world link: `https://bosque.<subdomain>.workers.dev/?mundo=familia-xxxx`.

- [ ] **Step 5: Backup before inviting the kids**

```bash
curl https://bosque.<subdomain>.workers.dev/admin/familia-xxxx/export -H "Authorization: Bearer <ADMIN_TOKEN>" > backups/familia-$(date +%F).json
```
(`backups/` is gitignored; add it to `.gitignore`.)
