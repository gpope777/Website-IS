# Aventura — Slice 2 · S2-A: Costa, Ciénaga y nombres — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the south of the map. The heightmap grows from 480 × 480 to 480 × 700 m. Between the forest and the sea lies **la Ciénaga**, withered mud that slows and bites walkers. The deer crosses it, and now carries **two** (rider + passenger, Gabriel's decision) so nobody is left behind. Deep water turns back swimmers on foot. All player-facing proper names move to `src/shared/names.ts`.

**Architecture:** `terrain.ts` keeps today's `heightAt` for `z < COAST_Z0` and blends over 20 m into `coastHeight` (bands of spec §3.1 plus seeded islets and the dungeon island from `src/shared/coast.ts`). Map bounds become one helper `inMap(x, z, pad)` (north/east/west at `HALF`, south at `SOUTH`) used by the server, the client body, `clampStep` and wolves. The Ciénaga and deep-water rules are pure functions in `coast.ts` (`inCienaga`, `depthAt`) used by both `WorldSim.onMove`/`step` and `client/movement.ts`. The passenger is a live-only `Live.seat` (the rider's name): the server moves the passenger with the rider every tick and ignores its `move` positions.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §3 (world extension, Ciénaga, water rules), §9 (names), §11.1, §12 (plan map, row S2-A). The "Decisiones de Gabriel" block overrides the rest: **the deer carries 2**.

## Global Constraints

- Player-facing text in **Spanish**, dry voice.
- **Phones first. Touch grid stays at 10 pills.** Boarding / leaving the passenger seat is the contextual **A** (keyboard E / M), like mounting.
- **Trust boundary:** every client message through `decodeClient`; the server validates reach, rider state, water depth and mud.
- **Protocol:** Task 4 bumps `PROTOCOL_VERSION` 12 → 13 (`mount` acts 4/5, `PlayerView.seat`, `SelfState.seat`). No new saved fields (the seat is live-only): old saves load.
- **Old worlds:** the coast appears from the seed. Forest terrain for `z < COAST_Z0` is unchanged. Resource ids shift (the old z-rim band is gone); saved partial harvests may map to other bushes and regrow within minutes. **[D]** Accepted, noted in the handoff.
- **Mobile performance:** the far sea (`z > HALF + 90`) uses a coarse mesh (×2 cell size); the water plane is one quad. Report draw-call / vertex change in the handoff.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: `names.ts` and migration

**Files:** Create `src/shared/names.ts`, `src/shared/names.test.ts`; Modify `src/shared/items.ts`, `src/shared/sim/world-sim.ts`, `src/shared/sim/wolves.ts`, `src/shared/sim/marchito.ts`, `src/client/mount-ui.ts`, `src/client/dungeon-ui.ts`, `src/client/game.ts`, `src/client/hud.ts`.

**Interfaces:**
```ts
export const NAMES = { villain: 'El Marchito', heart: 'Corazón del Bosque', forestRoot: 'Raíz-madre', coastRoot: 'Raíz-madre de la Costa',
  bossForest: 'Tragón de Papel', bossCoast: 'El Antenón', eliteForest: 'bruto reforzado', eliteCoast: 'bruto escudado',
  powerVine: 'Enredadera', powerWind: 'Viento', biomeForest: 'el Bosque', biomeCoast: 'la Costa', gate: 'la Ciénaga',
  deer: 'el Ciervo', fish: 'el Pez Grande', whale: 'la Ballena', pearl: 'perla', bossForestShort: 'Tragón' } as const;
```
- [ ] **Step 1: failing test.** `names.test.ts` reads every non-test `.ts` under `src/` (node `fs`), strips comments, and fails if a string literal / template contains `Marchito`, `Tragón`, `Raíz-madre`, `Corazón del Bosque`, `Enredadera` (capitalised), `bruto reforzado` or `Ciénaga`, except in `names.ts`.
- [ ] **Step 2: migrate** every hit to `${NAMES.x}` (article kept inside each sentence). Existing tests that assert exact strings keep passing (same text).
- [ ] **Step 3:** green, self-review, commit `refactor(aventura): nombres propios en un solo archivo`.

### Task 2: Coast terrain (shared)

**Files:** Create `src/shared/coast.ts` + `coast.test.ts`; Modify `src/shared/terrain.ts`, `src/shared/crags.ts`, `src/shared/resources.ts`, `src/shared/dungeon.ts` (`clampStep` map edge), `src/shared/sim/wolves.ts` (clamp), `src/shared/sim/world-sim.ts` (inBounds, onPower offMap), `src/client/movement.ts` (`mapBounds`); Tests `worldgen.test.ts`, `crags.test.ts`.

**Interfaces:**
```ts
// terrain.ts
export const COAST_Z0 = HALF - 40;      // 200: forest function ends, 20 m blend starts
export const SOUTH = HALF + 220;        // 460: south rim
export function inMap(x: number, z: number, pad: number): boolean;   // |x| < HALF-pad, -HALF+pad < z < SOUTH-pad
export function clampMap(x: number, z: number, pad: number): { x: number; z: number };
// coast.ts
export const COAST = { cienaga: [-40, 20], beach: [20, 50], shallows: [50, 90], deep: [90, 200], rim: [200, 220], mud: WATER_LEVEL + 0.3, seabed: -18, islets: 3 } as const; // offsets from HALF
export interface Islet { x: number; z: number; r: number; top: number }
export function coastFeatures(seed: number): { islets: Islet[]; island: Islet };   // seeded, no terrain needed
export function coastHeight(x: number, z: number, noise: Noise2D, f: ReturnType<typeof coastFeatures>): number;
export function inCienaga(x: number, z: number): boolean;
export function depthAt(t: Terrain, x: number, z: number): number;  // WATER_LEVEL - heightAt
```
- [ ] **Step 1: failing tests.**
  - For 4 seeds, `heightAt` for `z < COAST_Z0` equals the old function (a copy kept in the test).
  - Ciénaga band is flat at `COAST.mud` (dry, above `WATER_LEVEL`) between `z = HALF - 20` and `HALF + 20`; beach mostly dry; shallows depth 1–4; deep sea depth > 4 except on islets; the south rim at `SOUTH - 5` is above water; the island top is dry.
  - Islets are 3, inside the deep band, 18–25 m across, not overlapping the island (`z ≈ HALF + 170`).
  - No crag within 60 m north of the Ciénaga (`z > COAST_Z0 - 60`); no resource with `z ≥ COAST_Z0`.
  - `inMap`: `(0, HALF + 100)` in, `(0, SOUTH)` out, `(0, -HALF)` out.
- [ ] **Step 2: implement.** The forest function drops only its south z-rim (identical for `z < COAST_Z0`); the x-rim applies over the coast too. Replace every `|z| < HALF - k` bound with `inMap`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la Costa en el mapa (Ciénaga, playa, mar, islotes)`.

### Task 3: Ciénaga and deep water (server + client rules)

**Files:** Modify `src/shared/coast.ts`, `src/shared/sim/world-sim.ts`, `src/client/movement.ts`, `src/client/game.ts` (edge warning); Tests `world-sim.test.ts`, `movement.test.ts`, `coast.test.ts`.

**Interfaces:**
```ts
export const CIENAGA = { speed: 3, dps: 8 } as const;   // coast.ts
export const SWIM_MAX_DEPTH = 4;
export function deepStepOk(t: Terrain, px: number, pz: number, nx: number, nz: number): boolean; // depth ≤ 4 or not deeper than before
```
- [ ] **Step 1: failing tests.**
  - A walker standing in the Ciénaga loses ~8 PV/s (`step` for 5 s → −40 ± 2); a rider does not; dead/away players do not.
  - A walker's move inside the mud faster than `CIENAGA.speed` (with margin) is rejected (`fix`); at 3 m/s accepted. A rider's 12 m/s move there is accepted.
  - Swimming (y < WATER_LEVEL − 0.5) into depth > 4 that gets deeper → rejected with one toast "La corriente te devuelve"; a move toward shallower water from deep is accepted; a glider above the sea (y high) is not blocked by depth.
  - Client `stepBody`: walking in mud moves at `CIENAGA.speed`; swimming toward deeper-than-4 water stops like the deer at the shore.
- [ ] **Step 2: implement.** `WorldSim.step`: after vitals, `damage(p.vitals, CIENAGA.dps * dt)` for grounded walkers in the mud (`y < ground + 1.5`, not riding, not seated) and a throttled toast "El barro marchito muerde. A lomos del ciervo no". `onMove`: mud cap and `deepStepOk` for swimmers. Client: mud speed; a one-time hint when you reach the Ciénaga edge on foot.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la Ciénaga muerde y el mar hondo devuelve`.

### Task 4: Deer passenger seat (protocol v13)

**Where:** here, because it is part of Ciénaga access (spec decision: nobody left out of the Costa).

**Files:** Modify `src/shared/protocol.ts` (v13), `src/shared/sim/world-sim.ts`, `src/client/mount-ui.ts`, `src/client/game.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`, `mount-ui.test.ts`.

**Interfaces:**
```ts
// mount act 4 = sit behind the nearest rider within MOUNT.reach (seat free); act 5 = get off the seat.
// Live.seat: string | null (rider's name); PlayerView.seat: string | null; SelfState.seat: string | null
export const MOUNT.seatBack = 0.6;  // metres behind the rider
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts acts 4 and 5. A walker ≤3.5 m from a rider boards with act 4; a second walker cannot (seat taken); a rider or someone with a pending tame cannot board. Each tick the passenger is placed at the rider's position (minus `seatBack` along yaw) and its own `move` positions are ignored (no `fix` spam). The passenger takes no Ciénaga damage. The rider dismounting, dying, going away or entering the dungeon drops the passenger (grace `MOUNT.grace` for the speed cap). Act 5 drops only the passenger. `mountAction`: near a friend's rider with no passenger → `{ act: 4, label: 'Subir detrás' }`; seated → `{ act: 5, label: 'Bajar' }`.
- [ ] **Step 2: implement.** Client: while `self.seat`, the body follows the rider's interpolated remote pose (+ `MOUNT.height`), no stepBody; the seated actor renders at the deer seat; prompt "E · Subir detrás de X" / "E / M · Bajar".
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el ciervo lleva a dos`.

### Task 5: Client — coast mesh, water, sand and mud colours

**Files:** Modify `src/client/scene/terrain-mesh.ts`, `src/client/game.ts`, `src/client/scene/vegetation.ts` (grass only in the forest); Test `src/client/scene/terrain-mesh.test.ts` (pure helper for the grid split).

**Interfaces:**
```ts
export const NEAR_SOUTH = HALF + 90;   // fine grid ends here
export function terrainPatches(segments: number): { z0: number; z1: number; segX: number; segZ: number }[]; // forest+beach at the tier's cell size, far sea at ×2
```
- [ ] **Step 1: failing test** for `terrainPatches` (two patches covering `-HALF … SOUTH`, far patch has half the density per metre).
- [ ] **Step 2: implement.** Two meshes sharing one material; the tint function works on both. Colours: purple-brown mud in the Ciénaga, sand on the beach, dark seabed. One water quad covering the whole map. Grass stays north of `COAST_Z0`. Log vertices/draw calls before/after in the handoff.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de la Costa`.

### Task 6: Ship

- [ ] Push `aventura/slice-1`; append "Slice 2 · S2-A" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #2. No merge, no deploy.
