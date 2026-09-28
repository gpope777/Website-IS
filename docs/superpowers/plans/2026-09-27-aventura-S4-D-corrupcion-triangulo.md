# Aventura — Slice 4 · S4-D: corrupción de la Montaña y El Triángulo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Four mountain corruption zones (ids 14–17) in the shared list. Zone 14 is the **Raíz-madre de la Montaña** (r 18) at the spot where S4-E will open the cave mouth; 15 on a Faldas meadow, 16 at a pared's foot, 17 on the high snowfield (r 16). Same visuals and night rule (in the mountains the extra beasts spawn at the Peldaños' foot, on the forest side). **Mountain shrine orbs cleanse the nearest corrupt 15–17** (never 14). A **mountains-seen flag** (`SavedWorld.mountainsSeen`). With the mountains seen and zone 14 corrupt, raids with **`raidN % 3 === 1`** (from raid 4) are led by **El Triángulo** (`enemy7.png` paper cutout, 2.8 m, 340 PV, wolf speed, kicks 12 every 2 s; every 6 s throws a rock at the nearest player structure within 25 m for 40 damage, never the Heart; spawns 12 m behind his pack). Beating him: the raid flees (as the Gata), **2 cuarzo** to each living player within 40 m, vision «Mis rocas… <nombres>, sube a por mí, a ver».

**Architecture:** `src/shared/corruption.ts` gains `MOUNTAIN_ZONES`, `generateMountainZones(terrain, seed)`, `isMountainZone`; `isSwampZone` narrows to 10–13; `allZones` appends mountain zones. `src/shared/sim/lieutenant.ts` gains `TRIANGULO`, `triLeads`, `stepTriangulo` (shares the Gata's walk through a small `stepLieutenant` helper) and `rockTarget`. `EnemyKind` gains `'lieut2'`. The sim keeps `mountainsSeen`, the Triángulo's id and a rock timer; the Gata's fall handler becomes one lieutenant-fall handler.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §6, §7, §12, §15.3 (row S4-D of the plan map).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.lieutenant2`, `NAMES.mountainRoot`, `NAMES.quartz`).
- **Touch grid stays at 10 pills.** No new action: orbs (A) and normal combat.
- **Trust boundary:** no new client message; everything is server-side.
- **Protocol:** Task 2 bumps 36 → 37 (shared zone list changes), Task 3 bumps 37 → 38 (`EnemyKind` + `'lieut2'`). New saved field `mountainsSeen?` optional; old saves load with 14–17 corrupt.
- **[D] Mountain ids fixed 14–17.** Zone 14 sits at a fixed point, `MOUNTAIN_ZONES.root` = x −70, d 140 (north of the rim) — S4-E puts the cave mouth there. 15 = seeded gentle point (slope < 20°) at d 45–100 clear of paredes; 16 = the foot of pared 0 on its forest side; 17 = seeded gentle point at d 150–195 (the snowfield).
- **[D] Other cleansing is later:** `// S4-E` marker (a Piedra pillar ≤2 m of a 15–17 root crushes it) and `// S4-F` marker (beating El Cucurucho cleans 14 → the Triángulo stops, since `triLeads` looks at 14). Enredadera, Viento and Llamarada never cleanse mountain zones.
- **[D] `mountainsSeen`** = any living active player `inMountains`. The entry vision is S4-H (`// S4-H` marker); here the flag is silent.
- **[D] Rock throw:** instant, no projectile drawn; targets any non-Heart structure (walls, traps, fires, campfires) within 25 m of him; `// S4-E` marker: pillars too once they exist. A toast "El Triángulo lanza una roca" to nobody (just the `hit`/`wrecked` messages the client already shows).
- **[D] "Stays 12 m behind":** spawns `RAID.spawnMax + 12` m out; same hold/sight as the Gata (waits 14 m from the Heart with nobody in 28 m).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Mountain zones (shared)

**Files:** Modify `src/shared/corruption.ts`; Test `src/shared/corruption.test.ts`.

**Interfaces:**
```ts
export const MOUNTAIN_ZONES = { firstId: 14, root: 14, r: 16, rootR: 18, rootX: -70, rootD: 140 } as const;
export function isSwampZone(id: number): boolean;    // 10..13 (was >= 10)
export function isMountainZone(id: number): boolean; // >= 14
export function generateMountainZones(terrain: Terrain, seed: number): Zone[]; // 14,15,16,17
```
- [x] **Step 1: failing tests.** For 4 seeds: `allZones` ends with 14–17; 14 at the fixed root (r 18); all `inMountains`; 15 at d 45–100 and 17 at d 150–195 with `slopeAt < 20`; 16 within 4 m of pared 0's foot circle (`rt + w`); no two overlap. `isSwampZone(14) === false`, `isMountainZone(14)`, `isMountainZone(13) === false`.
- [x] **Step 2: implement** (`createRng(seed ^ 0x40e7a)`; fallbacks: fixed points).
- [x] **Step 3:** green, self-review, commit `feat(aventura): zonas corruptas de la Montaña (reglas)`.

### Task 2: Server — mountain orbs cleanse, night rule, mountainsSeen (protocol v37)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.
- [x] **Step 1: failing tests.** New world `snap.corrupt` includes 14–17. A mountain orb cleanses the nearest corrupt 15–17 ("La luz del santuario limpia un trozo de montaña"), never 14, never others; a swamp orb never cleanses a mountain zone. Enredadera at zone 15's root cleanses nothing. A player standing in zone 15 at dusk brings extra beasts that spawn south of the rim (z > −HALF). Entering the mountains sets `mountainsSeen` (saved; absent in old saves). Version → 37.
- [x] **Step 2: implement.** Resolve `// S4-D` in `onShrine` (biome map gets `mountain`, root 14 excluded); vine filter excludes mountain; extra-beast spawn clamps to the Peldaños' foot; add `// S4-E` / `// S4-F` / `// S4-H` markers.
- [x] **Step 3:** green, self-review, commit `feat(aventura): corrupción de la Montaña en el servidor (protocolo v37)`.

### Task 3: El Triángulo (rules + server, protocol v38)

**Files:** Modify `src/shared/sim/lieutenant.ts` + test, `src/shared/protocol.ts` (`EnemyKind`), `src/shared/sim/wolves.ts` (`ENEMY.lieut2`, label), `src/shared/sim/marchito.ts` (`VISION.triangulo`), `src/shared/sim/world-sim.ts`; Tests.

**Interfaces:**
```ts
export const TRIANGULO = { hp: 340, damage: 12, every: 3, offset: 1, rockEvery: 6, rockRange: 25, rockDamage: 40, quartz: 2, present: 40, behind: 12 } as const;
export function triLeads(raidN: number, mountainsSeen: boolean, corrupt: readonly number[]): boolean; // seen && 14 corrupt && raidN > 1 && raidN % 3 === 1
export function stepTriangulo(w, targets, goal, terrain, dt, rng): string | null; // same walk as the Gata
export function rockTarget(w: { x: number; z: number }, structures: readonly { id: number; kind: string; x: number; z: number }[]): number | null;
```
- [x] **Step 1: failing tests.** Pure: `triLeads` truth table (1 → false, 4/7 → true, never with `gataLeads` for the same n); `rockTarget` picks the nearest non-Heart within 25 m, null with only the Heart. Sim: raid 4 with mountains seen: warning "El Triángulo guía el asedio esta noche", one `lieut2` with 340 PV; raid 4 without seen or with 14 cleansed: none; a wall 10 m from him loses 40 after 6 s, the Heart never loses PV to rocks. Killing him: pack flees, near player +2 cuarzo, far none, vision "Mis rocas". Version → 38.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(aventura): El Triángulo guía asedios (protocolo v38)`.

### Task 4: Client — El Triángulo as a paper cutout

**Files:** Modify `src/client/game.ts`.
- [x] **Step 1:** `TRIANGULO_IMG = '/enemies/enemy7.png'` (455 × 469, real alpha), `PaperActor(TRIANGULO_IMG, 2.8, camera, 455 / 469)` for `lieut2`, white tint. `check` + `build`.
- [x] **Step 2:** green, self-review, commit `feat(aventura): cliente de El Triángulo`.

### Task 5: Ship

- [x] Push `aventura/resto`; append "Slice 4 · S4-D" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. No merge, no deploy.
