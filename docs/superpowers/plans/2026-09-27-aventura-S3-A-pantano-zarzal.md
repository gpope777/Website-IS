# Aventura — Slice 3 · S3-A: el Pantano, el Zarzal y la Boca del Río — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the west of the map. A 180 × 350 m swamp (`−HALF − 180 < x < −HALF`, `40 < z < HALF + 150`) grows beside the forest and the coast: knee-deep bog, seeded montículos, the deep **Laguna Negra** and a 5 m deep **Boca del Río** that connects it to the coast's deep sea. **El Zarzal** (withered thorns) bites and slows anyone on foot or on the deer, so the fish (or the whale) up the river is the way in. A swimmer on foot may always swim *downstream* (east) in the river, so nobody gets stuck. The client draws the swamp with a coarse mesh and thick fog.

**Architecture:** `terrain.ts` gains `SWAMP`, `RIVER`, `LAGUNA`, `swampFeatures(seed)` (montículos), `inSwamp`, `inRiver`, and `heightAt` picks the swamp for `x < −HALF` (12 m seam that starts at the forest/coast edge height, so nothing east of `−HALF` changes except the river carve at `x < −HALF + 30`). `inMap` / `clampMap` become the union of the main rectangle and the swamp rectangle. Rules live in a new `src/shared/swamp.ts` (`ZARZAL`, `zarzalAt`, `BOG`, `inBog`, `swampFog`), used by `WorldSim.step`/`onMove` and `client/movement.ts`, like the Ciénaga. `deepStepOk` also applies in the swamp and accepts eastward moves in the river.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §3 (world, Zarzal, river, fog), §12 (names), §14.1–14.4, §15 row S3-A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Every proper name through `NAMES`.
- **Phones first. Touch grid stays at 10 pills.** This plan adds no action.
- **Trust boundary:** the server validates thorn speed, bog speed, deep water and bounds; the client mirrors the same pure functions.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 22 → 23 (the terrain changed: client and server must agree). No new saved fields: old saves load.
- **Old worlds:** forest and coast terrain for `x ≥ −HALF` are identical except the river carve (`x < −HALF + 30`, `|z − (HALF + 103)| < 10`, deep sea already). Crags within 64 m of the west edge disappear (no gliding over the Zarzal); a shrine or zone that sat on one may move. Building is only allowed in the forest (`inForest(…, 4)`), so no base piece can sit in the thorns.
- **Mobile performance:** swamp mesh at ×2 cell size (≈1 800 vertices on the low tier), +1 draw call for it, +1 for the instanced thorns; one water quad (wider). Inside the swamp the fog closes to near 35 / far 70 m and the camera far plane drops to 100 m.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Swamp terrain, 3-rectangle bounds and names

**Files:** Modify `src/shared/terrain.ts`, `src/shared/crags.ts`, `src/shared/names.ts`, `src/shared/names.test.ts`; Create `src/shared/swamp.test.ts` (terrain part); Tests `coast.test.ts`, `crags.test.ts`.

**Interfaces:**
```ts
// terrain.ts
export const SWAMP = { x0: -HALF - 180, x1: -HALF, z0: 40, z1: HALF + 150, seam: 12, rim: 15 } as const;
export const RIVER = { z: HALF + 103, half: 8, bank: 2, x0: -HALF - 70, x1: -HALF + 30, bed: WATER_LEVEL - 5 } as const;
export const LAGUNA = { x: -HALF - 115, z: HALF + 100, rx: 50, rz: 35, bed: WATER_LEVEL - 5, deep: WATER_LEVEL - 8 } as const;
export interface Mound { x: number; z: number; r: number; top: number }
export function swampFeatures(seed: number): { mounds: Mound[] };   // 12 montículos, seeded
export function inSwamp(x: number, z: number): boolean;              // SWAMP rectangle (x < −HALF)
export function inRiver(x: number, z: number): boolean;              // RIVER channel
// inMap / clampMap: union of |x|<HALF,−HALF<z<SOUTH and the swamp rectangle (1 m overlap at x = −HALF, no pad on that side)
// names.ts: biomeSwamp, swampRoot, swampGate, river, bossSwamp, eliteSwamp, lieutenant1, powerFire, frog, amber, capa, fogata
```
- [ ] **Step 1: failing tests.**
  - For 4 seeds, `heightAt` for `−HALF ≤ x < HALF` equals the Slice 2 function (reuse `oldHeight` from `coast.test.ts`) everywhere except the river carve.
  - At `x = −HALF − 0.01` the height is within 0.5 m of `x = −HALF` (seam continuous).
  - Bog: over 200 sampled points in the swamp interior (away from mounds, Laguna, river, rims) ≥ 70 % have depth 0.3–0.6 (wading), none deeper than 1.6.
  - Laguna centre depth 7–8.2; river centre depth ≥ 5 along `x ∈ [−HALF − 60, −HALF + 25]`, 16 m wide.
  - 12 mounds, radius 6–15, tops above water, inside `x ∈ [−HALF − 160, −HALF − 70]`, not in the Laguna or the river, not overlapping.
  - Rims: `x = SWAMP.x0 + 3` and `z = SWAMP.z0 + 3` / `SWAMP.z1 − 3` are above water.
  - `inMap(−HALF − 100, 200, 2)` true; `inMap(−HALF − 100, 20, 2)` false; `inMap(−HALF − 1, 100, 2)` true (the seam is walkable); `clampMap(−HALF − 300, 100, 3)` → `{ x: SWAMP.x0 + 3, z: 100 }`; `clampMap(−HALF − 50, 10, 3)` goes to the nearest of the two rectangles.
  - No crag with `x < −HALF + 64`.
  - `names.test.ts` also forbids hand-written `Pantano` and `Zarzal`.
- [ ] **Step 2: implement.** `heightAt`: `x ≥ −HALF` → today's function; `x < −HALF` → `lerp(edge(z), swamp(x, z), smooth((−HALF − x) / SWAMP.seam))` where `edge(z)` is today's height at `x = −HALF`. `swamp`: bog `WATER_LEVEL − 0.3 − 1.2 · smooth((n − 0.58)/0.2)` (mostly 0.3 deep, a few pools), mounds (quadratic caps), Laguna ellipse bowl, rims. Then the river carve (`min` with the bed, 2 m banks) for every region. Crags: skip `x < −HALF + 64`. Add the §12 names.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el Pantano en el mapa (ciénaga alta, montículos, Laguna, río)`.

### Task 2: Zarzal, bog and river rules (server, protocol v23)

**Files:** Create `src/shared/swamp.ts`; Modify `src/shared/coast.ts` (`deepStepOk`), `src/shared/fish.ts` (`fishStepOk`), `src/shared/sim/world-sim.ts`, `src/shared/protocol.ts`; Tests `swamp.test.ts`, `world-sim.test.ts`, `fish.test.ts`, `protocol.test.ts`.

**Interfaces:**
```ts
export const ZARZAL = { speed: 3, dps: 10, x0: -HALF - 60, x1: -HALF + 4, dry: 1 } as const; // thorns where water < 1 m
export const BOG = { k: 0.6 } as const;                                                      // walkers wade at 60 %
export function zarzalAt(t: Terrain, x: number, z: number): boolean;
export function inBog(t: Terrain, x: number, z: number): boolean;   // swamp, 0 < depth < 0.6, outside the Zarzal
export function swampFog(x: number, z: number): number;             // 0 outside … 1 twenty metres in (Task 4)
```
- [ ] **Step 1: failing tests.**
  - `zarzalAt`: true on the forest rim at `x = −HALF + 2` inside the swamp's z range, on the bog at `x = −HALF − 40`; false at `x = −HALF + 6`, in the river, at `x = −HALF − 80`, at `z = 20`.
  - A walker standing in the Zarzal loses ~10 PV/s (5 s → −50 ± 2); a deer rider too ("no respetan al ciervo"); away/dead players don't.
  - A walker's or rider's move inside the Zarzal faster than 3 m/s (+ margin) is rejected; at 3 m/s accepted. A walker in the bog at 7 m/s is rejected, at 4.5 m/s accepted.
  - Swimming from the coast into the river (5 m) is rejected with "La corriente te devuelve"; inside the river a move east is accepted, a move west (same depth) rejected; from the Laguna toward shallower water accepted.
  - `fishStepOk` in the swamp needs ≥ 1 m of water (river and Laguna yes, 0.3 m bog no).
  - `PROTOCOL_VERSION` is 23 (existing assertions updated: intentional bump).
- [ ] **Step 2: implement.** `deepStepOk`: also in the swamp (`nz ≥ COAST_Z0 || inSwamp(nx, nz)`), and `inRiver(nx, nz) && nx > px` always passes. `WorldSim.step`: grounded players (walkers, deer riders, passengers) in `zarzalAt` take `ZARZAL.dps · dt` and a throttled hint "`El Zarzal` muerde. Las espinas no respetan al ciervo" (name from `NAMES.swampGate`, capitalised). `onMove`: when both the window anchor and the new point are in the Zarzal, cap = `ZARZAL.speed` (walkers and deer); both in the bog, walkers' cap = `MAX_SPEED · BOG.k`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el Zarzal muerde y el río solo se nada hacia el mar (protocolo v23)`.

### Task 3: Client movement in the swamp

**Files:** Modify `src/client/movement.ts`; Test `src/client/movement.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` on foot in the Zarzal moves at ≤ 3 m/s (sprinting too); on the deer too; in the bog walking at 0.6 × `SPEED.walk`, running at 0.6 × `SPEED.run`; swimming in the river toward the sea moves, toward the Laguna stops; the map clamp lets you walk from `x = −HALF + 3` to `x = −HALF − 3` at `z = 100`.
- [ ] **Step 2: implement** with the shared `zarzalAt` / `inBog` / `deepStepOk` (no duplicated numbers).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): moverse por el Pantano en el cliente`.

### Task 4: Client — swamp mesh, thorns, water and fog

**Files:** Modify `src/client/scene/terrain-mesh.ts`, `src/client/scene/sky.ts`, `src/client/game.ts`; Tests `terrain-mesh.test.ts`, `swamp.test.ts` (`swampFog`).

**Interfaces:**
```ts
export interface Patch { x0: number; x1: number; z0: number; z1: number; segX: number; segZ: number }
export function terrainPatches(segments: number): Patch[];   // + swamp patch at ×2 cell size
export function buildThorns(terrain: Terrain, seed: number): THREE.InstancedMesh; // ~220 dark spikes, one draw call
// DayLight.update(f, focus, raid, swamp = 0): fog near → 35, far → 70 by `swamp`
```
- [ ] **Step 1: failing tests.** `terrainPatches` returns 3 patches; the swamp one covers `SWAMP` with half the density per metre. `swampFog` is 0 at `x = −HALF + 1`, 1 at `x = −HALF − 20` inside the z range, 0 at `z = 0` (outside), monotonic in between.
- [ ] **Step 2: implement.** Colours: dark olive bog, grey-violet thorn band (where `zarzalAt`), dark grass on mounds, dark Laguna bed. Water quad widened to cover the swamp. Thorns: seeded spikes on Zarzal cells, one `InstancedMesh`. Fog: `DayLight.update` lerps near/far toward 35/70 by `swampFog(player)`; camera far drops to 100 when `swampFog ≥ 1` (`updateProjectionMatrix` only on change).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del Pantano (malla, espinas, niebla)`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 3 · S3-A" to `docs/superpowers/HANDOFF-aventura.md` (commits, tests, decisions, perf numbers, qué probar); one short comment on PR #3. No merge, no deploy.
