# Visuales · V2-C: Terreno, hierba, viento y la sanación visible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row V2-C of the spec's plan map (§14), preceded by a harness fix. (0) In a full 3-tier `npm run perf` the test player can die at night on the server (the client holds it at the stops but the server keeps it at spawn, and the 6-min day turns to night mid-run), so graves/drawings change the texture counts. Make the harness keep it alive with an admin import of a safe state (perf-only, no production change). (1) Then the living world: **wind-swayed grass in every biome with ground** (32 m chunks, per-tier density/radius), **wind on tree crowns, pines and the Puestos' awnings**, **ground colours** (snow by height/slope, wet sand, mud, dirt paths, vertex noise), **corrupted-zone shading in the shader** (terrain, grass, trees), **the healing wave** (Idea de Claude: 20 s wave from a cleansed root; every zone at once when El Marchito falls) and the **Purified end-state look** of the Tierras.

**Architecture:** pure data/maths in `src/client/scene/ground.ts` (grass density/colour per biome, chunk seeding, ground-colour rules; +test) and `src/client/scene/heal.ts` (zone heal waves and the purify ramp; +test). `scene/grass.ts` builds chunk meshes; `scene/patches.ts` stays the only module with shader chunks: it gains a **wind** patch and a **corruption** patch that compose with the V2-B world patch (fog/glow). `terrain-mesh.ts` gets the ground-colour rules; `looks.ts` a Purified key set; `game.ts` wires it.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, harness `npm run perf` (V2-A/B).

**Spec:** `docs/superpowers/specs/2026-09-27-visuales-design.md` §3, §4, §5.3, §5.6 (awnings), §5.7, §11, §14 (V2-C).

## Global Constraints

- **No gameplay/collision/protocol change.** `PROTOCOL_VERSION` stays 62. Nothing new is sent or saved. Terrain geometry and heights are untouched (only colours).
- **Budgets (§3):** low ≤ 120 calls / 250 k tris, medium ≤ 180 / 500 k, high ≤ 260 / 1.2 M. Harness at the end of Task 3 and in the Ship task; `--update` only when the added cost is the intended one, before/after in the HANDOFF.
- No new lights, no vertex-texture fetch (old phones, spec §13), no new downloads.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Harness safety = admin import, not a god mode.** Before each tier (and before a stop when > 100 s passed since the last one) the harness exports the world, sets `time` to 0.3 of a day, marks every player alive with full vitals, and imports it back; the page reconnects by itself and the harness waits for `__perf.online()`. Nothing changes in the game or the server; the import endpoint already exists behind the admin token.
- **[D] Grass chunks = one `Mesh` per 32 m chunk with heights baked on the CPU** (seeded per chunk, cached), sharing one material, instead of one `InstancedMesh` of chunks reading a height texture: no vertex texture fetch (spec §13 risk), Three's frustum culling per chunk, and the heights are exact. Costs one draw call per visible chunk (≈ 4–8 low, 8–16 medium, 15–30 high): all tiers have the headroom (max today 66 / 145 / 184). The old tufts (`buildGrass`) go.
- **[D] Blade** = 7 vertices, 5 triangles (bent quad, 3 pairs + tip), baked root→tip colour per biome, 0.35–0.9 m. Attribute `aRoot` (x, z, t = height fraction, rnd) drives wind, corruption and the flower ring.
- **[D] Where grass grows** (pure `grassDensity`): forest 1 (0.35 under dense canopy), Costa dunes 0.4 (tall pale, none on wet sand/below +0.4 m), swamp 0.5 (dark reeds, not in water), mountains 0.7 up to depth 120 m (none on snow, the chute, los Peldaños or slopes > 35°), Tierras 0 (purified 0.8, shown by the purify uniform), never under water, in El Zarzal or on dungeon floors.
- **[D] Wind** = shared uniforms (`windT`, `windDir`, `windAmp`); low 1 wave, medium/high 2 waves + gusts (`waves` define), high also bends grass away from up to 4 players (`pressPos[4]`). Crowns/pines/bushes/awnings sway by height above a pivot (`sway` patch with `base`, `span`, `amp`), phase from the instance position.
- **[D] Ground colours on the CPU (vertex colours):** snow on mountains above 55 m and < 35° (blend), wet sand from the waterline to +0.4 m, mud patches in the swamp bog (noise), trampled dirt under dense canopy, ± 6 % vertex noise everywhere. Zero shader cost, same meshes.
- **[D] Corruption moves to the shader:** `uniform vec4 zones[22]` (x, z, r, heal front) read per vertex by the terrain, grass and tree patches (loop of 22 in the vertex shader, never per pixel). Terrain → the old violet `TAINT` (same `taintAt` falloff), grass → ash colour and 0.3 of the height, tree crowns → grey-violet. `tintTerrain` (a CPU recolour of ~50 k vertices) is removed.
- **[D] Healing wave:** a zone that goes corrupt → clean while you watch gets a front that grows from its root to `r + 4` in 20 s (`HealWaves`); a band of 2.5 m at the front paints grass tips white (flowers) and brightens the ground. Zones already clean on arrival are clean at once. When El Marchito falls (`ending` false → true live) every remaining zone waves at once and `purify` ramps 0 → 1 in 60 s from la Torre outward; on a later login it is 1 at once.
- **[D] Purified look:** Tierras ground ash/slate → pale meadow with golden veins in the shader (`purify` × distance to la Torre), Tierras grass appears (density 0.8, white flowers 8 %), and `lookAt` gets a `purificado` key set (bosque-like, more golden) mixed in by `purify`. The Lago Negro's water waits for V2-D (the water shader).
- **[D] Harness:** new stop `purificado` (Tierras with `purify = 1` via `PerfStop.purified`), day and night.

## File Structure

- Create `src/client/scene/ground.ts` (+test), `src/client/scene/heal.ts` (+test), `src/client/scene/grass.ts`.
- Modify `scripts/perf/run.mjs`, `scripts/perf/baseline.json`, `src/client/perf-hook.ts`, `src/client/scene/patches.ts` (+test), `src/client/scene/vegetation.ts`, `src/client/scene/terrain-mesh.ts`, `src/client/scene/stalls.ts`, `src/client/scene/looks.ts` (+test), `src/client/game.ts`.

## Tasks

### Task 1: harness — keep the test player alive

- [x] **Step 1:** `run.mjs` `safeWorld()`: `GET /admin/perf/export` → `time = 0.3 × 360`, players `dead: false`, full vitals → `POST /admin/perf/import`; called before each tier and before a stop when > 100 s passed; then wait `__perf.online()`.
- [x] **Step 2:** `perf-hook.ts` gains `online()` (last `NetStatus` is `online` and a welcome arrived after it) and `PerfStop.purified?` (read in Task 5).
- [x] **Step 3:** green; full `npm run perf` (3 tiers in one pass) → same calls/triangles as the base and textures stable across tiers. Commit `fix(perf): el jugador del arnés no muere de noche (import seguro)`.

### Task 2: pure — grass placement, ground colours, heal waves

```ts
// ground.ts
export type GrassBiome = 'bosque' | 'costa' | 'pantano' | 'montanas' | 'tierras';
export const GRASS: Record<GrassBiome | 'purificado', { root: number; tip: number; height: number; density: number }>;
export function grassBiome(x: number, z: number): GrassBiome;
export function grassDensity(t: Terrain, x: number, z: number): number; // 0..1, 0 = none
export const CHUNK = 32;
export function chunkKey(cx: number, cz: number): string;
export function chunksNear(x: number, z: number, radius: number): { cx: number; cz: number }[];
export interface Blade { x: number; y: number; z: number; h: number; yaw: number; biome: GrassBiome; rnd: number }
export function seedChunk(t: Terrain, cx: number, cz: number, n: number, seed: number, purified?: boolean): Blade[];
export function snowAmount(heightM: number, slopeDeg: number): number;
export function wetSand(h: number): number;
export function vertexNoise(x: number, z: number): number; // −1..1
// heal.ts
export const HEAL = { secs: 20, band: 2.5, purifySecs: 60 };
export class HealWaves { sync(corrupt: readonly number[], ending: boolean, now: number): void; front(zone: Zone, now: number): number; purify(now: number): number; }
```

- [x] **Step 1: failing tests** (`ground.test.ts`, `heal.test.ts`): biome of the harness stops; density 0 under water, on the chute, on snow, in Tierras (unless purified), > 0 in open forest; `chunksNear` covers the radius and nothing past `radius + 32√2`; `seedChunk` deterministic, stays in its chunk, n ≤ requested, heights = terrain; snow 0 at 40 m and 1 at 70 m flat, 0 on 45°; wet sand 1 at the waterline, 0 at +0.5; noise bounded. Heal: zones clean on first sync are healed at once; a zone that turns clean grows its front 0 → r+4 in 20 s; `ending` live → all waves + purify 0 → 1 in 60 s; `ending` on first sync → purify 1.
- [x] **Step 2: implement.** **Step 3:** green, commit `feat(visuales): hierba por bioma, colores de suelo y olas de sanación (puro)`.

### Task 3: grass chunks + wind (grass, crowns, pines, awnings)

- [x] **Step 1:** `patches.ts`: `WIND_UNIFORMS`, `patchGrass(mat, tier)` (wind on `aRoot.z²`, press on high, corruption ash + flower band), `patchSway(mat, opts)`; `patchWorld` composes with an existing `onBeforeCompile` (cache keys joined). Tests on a fake shader: grass chunk injected, keys distinct, world patch after sway keeps both.
- [x] **Step 2:** `grass.ts` `GrassField(terrain, seed, tier)`: cache of chunk meshes, `update(x, z)` shows chunks within `grassRadius`, hides/evicts far ones (LRU 64). Remove `buildGrass` and the tufts; sway on trees (crowns above 4.5 m), bushes, pines, awnings.
- [x] **Step 3:** green; harness per tier on bosque/costa/montañas with shots; if a tier passes its budget, lower `grassPerChunk` for it. Commit `feat(visuales): hierba con viento en todos los biomas; copas, pinos y toldos al viento`.

### Task 4: ground colours, corruption in the shader and the healing wave

- [x] **Step 1:** `terrain-mesh.ts` uses `snowAmount`/`wetSand`/mud/dirt/noise; `patchCorrupt(mat, kind)` for terrain (violet + light at the front) and tree crowns; `CORRUPT_UNIFORMS.zones[22]` from `HealWaves` each frame; `tintTerrain` removed.
- [x] **Step 2:** green; shots of a corrupt forest zone before/after cleansing (perf hook `heal(id)` in perf builds only drives the wave for the shot). Commit `feat(visuales): nieve, arena mojada, barro y senderos; zonas marchitas en el shader y la ola que sana`.

### Task 5: Purified end-state

- [x] **Step 1:** `looks.ts` `PURIFIED` keys + `lookAt` mix by `purify`; `purify` uniform in terrain/grass patches (Tierras ground → pale meadow + golden veins, their grass grows); `PerfStop.purified` forces it; harness stop `purificado`.
- [x] **Step 2:** tests for the look mix (purify 0 = tierras, 1 = purificado); green; shots day/night. Commit `feat(visuales): las Tierras purificadas florecen al caer El Marchito`.

### Task 6: Ship

- [x] Full harness `npm run perf` (3 tiers, one pass); `--update` with the new cost; HANDOFF "## Visuales · V2-C — …" with before/after table, decisions, what to test on a phone; push; one short comment on PR #3.
