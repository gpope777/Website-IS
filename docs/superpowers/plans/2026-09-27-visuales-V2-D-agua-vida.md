# Visuales · V2-D: Agua y vida ambiente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row V2-D of the spec's plan map (§14). (1) **A water shader** on the same quad as today: colour by depth read from a baked terrain map (fragment-side), shore foam, extra foam on the aguas bravas, sky-tinted fresnel and a sun glint, per-vertex waves on medium/high only (visual; the physics water level does not move), an underwater tint + short fog, caustics on the sea floor on high, and **el Lago Negro** on the same shader turning clean blue once las Tierras are purified (deferred from V2-C). (2) **Cheap ambient life per biome**, tier-scaled: bird flocks (1/2/3), fireflies (40/120/250), crabs on the Costa sand (medium/high), fish under the sea (high), and biome particles (leaves, midges, ash, loose snow; 200/400/600).

**Architecture:** pure data/maths in `src/client/scene/water-data.ts` (colours per water kind, the baked depth/kind map, wave maths, underwater test; +test) and `src/client/scene/life.ts` (per-tier amounts, which life shows where and when, flock paths, crab flight, wrap-around-the-player; +test). `scene/water.ts` builds the `ShaderMaterial` and meshes; `scene/ambient.ts` builds the life (all motion in vertex shaders except the 10 crabs). `scene/patches.ts` stays the only `onBeforeCompile` module: `patchGround` gains the caustics option. `game.ts` wires it; `pillars.ts` uses the lake material.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, harness `npm run perf` (V2-A/B/C).

**Spec:** `docs/superpowers/specs/2026-09-27-visuales-design.md` §3, §4 (Agua/Vida columns), §5.4, §5.6, §14 (V2-D).

## Global Constraints

- **No gameplay/collision/protocol change.** `PROTOCOL_VERSION` stays 62. Nothing new is sent or saved. `WATER_LEVEL`, `waterLevel()`, swimming and diving are untouched: waves are drawn only.
- **Budgets (§3):** low ≤ 120 calls / 250 k tris, medium ≤ 180 / 500 k, high ≤ 260 / 1.2 M. **Tightest today: medium bosque 154 / 429 k** → V2-D may add there at most ~+6 calls and ~+20 k triangles (waves 64² = 8 k, life < 1 k). New texture memory ≤ 2 MB on low.
- No new lights, no vertex-texture fetch (V2-C rule, spec §13), no downloads, no post-processing.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Depth = a baked map read in the fragment shader**, not the depth buffer and not per vertex: one RGBA8 `DataTexture` 512² over the water quad (660 × 700 m ≈ 1.3 m per texel), baked once at load from the shared `Terrain`. R = depth below `WATER_LEVEL` (0..16 m), G = swamp (no foam, murky), B = aguas bravas (ring around the dungeon island, `inBravas`). 1 MB on every tier. Fragment texture reads work on every phone (the V2-C "no vertex texture" rule is kept).
- **[D] Colours** in a `WATER` table per kind (`mar`, `pantano`, `lago`, `lagoLimpio`): shallow, deep, foam, alpha shallow/deep. Lit by a single `dayK` (the look's daylight with a night floor) plus the moon; reflection = fresnel toward the sky dome's horizon/zenith colours (same uniforms as the dome), sun glint Blinn with one power. No real reflection on any tier.
- **[D] Waves** = 2 small Gerstner-like sines (0.15 m, 18–31 m wavelength) on a `waterGrid`² quad (64 medium, 128 high; low stays 1 segment, flat); amplitude × 0.2 in the swamp (by x, no texture in the vertex). Ripples in the fragment normal on every tier (cheap sines) so low still glints.
- **[D] Underwater** (camera below the surface it is over): an HTML overlay (`pointer-events: none`) in the look's deep water colour at 0.35 opacity and the scene fog pulled to 2–28 m in that colour; the water quad is `DoubleSide` and its underside draws a bright, flat "surface from below".
- **[D] Caustics** on high only: `patchGround(mat, { caustics: true })` adds a 2-sine cell pattern (≈ 5 ALU) where the ground is below `WATER_LEVEL`, fading with depth and at night.
- **[D] Lago Negro** = the same shader, kind `lago`, a polar disc (8 rings × 40) with the bowl depth per vertex (it is its own mesh, so a vertex attribute is fine), purple rim glow; `purify` (V2-C uniform) mixes it to `lagoLimpio` (clear blue with foam at the rim). No waves (spec: lakes without waves).
- **[D] Ambient life amounts** from the tier (`lifeFor(tier)`): flocks 1/2/3 × 12 birds, fireflies = `TierSettings.ambient` (40/120/250), particles = `TierSettings.particles` (200/400/600), crabs 0/10/10, fish 0/0/20. Every system is 1 draw call and hidden when it has nothing to show; worst case +5 calls (Costa at noon on high: birds, crabs, fish, particles, + fireflies only at night).
- **[D] Where/when** (`lifeAt(biome, frac, purified)`): birds by day over bosque (dark), Costa (white gulls) and Montañas (3 big eagles, flock 0 only); fireflies at night in bosque, Pantano always (dimmer by day), purified Tierras golden at night; particles: bosque leaves by day, Pantano midges, Montañas loose snow (off while `WeatherFx` rains/snows), Tierras ash (purified: none); crabs on Costa sand by day; fish when the camera is in the Costa (seen when diving).
- **[D] Everything follows the player without CPU work:** fireflies and particles are `Points` seeded in a box that wraps around a `centre` uniform in the vertex shader (`mod`), height from the ground under the player; birds fly Lissajous loops around an anchor snapped to a 160 m grid near the player, wing flap in the vertex shader. Only crabs run on the CPU (10 positions: re-seeded on sand when the player moves 40 m; they scuttle sideways away when the player is < 4 m).
- **[D] Harness:** new stops `lago` and `lago-limpio` (the Lago Negro, second with `purified`), day and night. The base is updated on purpose (points appear where there were none).

## File Structure

- Create `src/client/scene/water-data.ts` (+test), `src/client/scene/water.ts`, `src/client/scene/life.ts` (+test), `src/client/scene/ambient.ts`.
- Modify `src/client/scene/terrain-mesh.ts` (`buildWater` goes), `src/client/scene/patches.ts` (+test: caustics), `src/client/scene/pillars.ts`, `src/client/game.ts`, `scripts/perf/run.mjs`, `scripts/perf/baseline.json`.

## Tasks

### Task 1: pure — water data and ambient life rules

```ts
// water-data.ts
export type WaterKind = 'mar' | 'pantano' | 'lago' | 'lagoLimpio';
export const WATER: Record<WaterKind, { shallow: number; deep: number; foam: number; aShallow: number; aDeep: number }>;
export const WATER_MAP = { size: 512, maxDepth: 16, x0, x1, z0, z1 };   // the water quad's extent
export function bakeWaterMap(t: Terrain, seed: number, size?: number): Uint8Array; // RGBA: depth, swamp, bravas, 255
export const WAVES: { amp: number; len: [number, number]; speed: number; swampK: number };
export function waveHeight(x: number, z: number, t: number): number; // CPU mirror of the shader, |h| ≤ amp
export function underwater(camY: number, surface: number): boolean;   // below by more than 0.05 m
// life.ts
export interface LifeAmounts { flocks: number; birds: number; fireflies: number; particles: number; crabs: number; fish: number }
export function lifeFor(tier: Tier): LifeAmounts;
export function lifeAt(biome: Biome, frac: number, purified: boolean): { birds: 'dark' | 'gull' | 'eagle' | null; fireflies: number; particles: 'leaves' | 'midges' | 'snow' | 'ash' | null; crabs: boolean; fish: boolean };
export function flockAnchor(x: number, z: number): { x: number; z: number };
export function flockPoint(i: number, t: number, anchor): { x: number; y: number; z: number };
export function wrap(v: number, centre: number, box: number): number;
export function crabStep(crab, player, dt): crab;  // flees sideways under 4 m
```

- [x] **Step 1: failing tests.** Water: map deterministic; forest/land texels have depth 0; beach→open sea depth grows; swamp texels flagged, sea not; bravas ring flagged around the island; `waveHeight` bounded by `amp` and smaller in the swamp; `underwater`. Life: amounts monotone low ≤ medium ≤ high and within §3 (1/2/3 flocks, 40/120/250); no birds/crabs at night; fireflies at night in the forest, always in the swamp, golden only purified; no ash once purified; `wrap` keeps within ±box/2 of the centre; flock points stay near their anchor; a crab within 4 m moves away, one far away stays.
- [x] **Step 2: implement.** **Step 3:** green, commit `feat(visuales): datos del agua y reglas de la vida ambiente (puro)`.

### Task 2: the water shader (sea and swamp)

- [x] **Step 1:** `water.ts`: `WATER_UNIFORMS` (time, sun dir/colour, zenith/horizon, `dayK`, map), `makeWaterMaterial(kind, opts)` (`ShaderMaterial`, `fog: true`, `transparent`, `DoubleSide`; fog, tone mapping and colour space chunks), `buildSea(terrain, seed, tier)` (quad `waterGrid`², map texture). Remove `buildWater` from `terrain-mesh.ts`; `game.ts` sets the uniforms each frame from `skyLook`/`DayLight`.
- [x] **Step 2:** green; harness `--stop costa,bajo-agua,pantano,bosque --shots` per tier: medium bosque still ≤ 180 / 500 k; look at the shore foam and the swamp. Commit `feat(visuales): agua con profundidad, espuma, cielo reflejado y olas en media/alta`.

### Task 3: underwater, caustics and el Lago Negro

- [x] **Step 1:** underwater overlay + fog in `game.ts` (per frame, from `underwater(camera.y, waterLevel(...))`); `patchGround(mat, { caustics })` on high (test: key and chunk only with the option); `pillars.ts` lake = `buildLake(...)` with kind `lago` → `lagoLimpio` by `purify`.
- [x] **Step 2:** harness stops `lago`, `lago-limpio`; green; shots bajo-agua (high: caustics), lago day/night, lago-limpio. Commit `feat(visuales): bajo el agua, cáusticas en alta y el Lago Negro que se limpia`.

### Task 4: ambient life

- [x] **Step 1:** `ambient.ts` `AmbientLife(scene, terrain, seed, tier)`: birds (`InstancedMesh`, V of 2 triangles, flap + path in the vertex shader), fireflies (`Points`, additive, wrap), particles (`Points`, per-kind colour/size/motion), crabs (`InstancedMesh`, CPU), fish (`InstancedMesh`, circle in the shader). `update(x, y, z, biome, frac, purified, precip, dt)`.
- [x] **Step 2:** green; harness on all stops for the tier (targeted), medium bosque day/night checked first; shots of costa/pantano/bosque night. Commit `feat(visuales): pájaros, luciérnagas, cangrejos, peces y partículas por bioma`.

### Task 5: Ship

- [x] Full harness `npm run perf` (3 tiers, one pass); `--update` with the new cost; HANDOFF "## Visuales · V2-D — …" with before/after table, decisions, what to test on a phone; push; one short comment on PR #3.
