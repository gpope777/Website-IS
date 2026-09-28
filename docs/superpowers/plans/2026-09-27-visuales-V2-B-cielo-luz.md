# Visuales · V2-B: Recorte por cercanía, cielo, luz y niebla — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row V2-B of the spec's plan map (§14), preceded by a perf fix. (0) The V2-A baseline shows low ≈ 530 k and medium ≈ 1 M triangles in *every* biome (budget 250 k / 500 k): something is drawn whole wherever you stand. Find it with the harness, fix it, re-baseline. (1) Then the day/night look: a pure **`BiomeLook`** table per biome × time of day, a **sky dome** (gradient, sun disc + halo, moon, clouds on medium/high, stars on high), **height fog** on medium/high, **truly dark nights**, **glow points** (lamps/fires/the Corazón brighten the world in the shader, no real lights) and **shadow discs** under actors on low.

**Architecture:** pure data and maths in `src/client/scene/looks.ts` (+test) and `src/client/scene/near-instances.ts` (+test); `scene/sky.ts` keeps `DayLight` but reads its colours from the look; `scene/sky-dome.ts` is one `ShaderMaterial` sphere; `scene/patches.ts` is the only place with `onBeforeCompile` shader chunks (height fog + glow), applied to the world's Lambert materials; `game.ts` wires it.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, harness `npm run perf` (V2-A).

**Spec:** `docs/superpowers/specs/2026-09-27-visuales-design.md` §3, §4, §5.1, §5.2, §5.3 (culling), §5.5, §14 (V2-B).

## Global Constraints

- **No gameplay/collision/protocol change.** `PROTOCOL_VERSION` stays 62. Nothing new is sent or saved.
- **Budgets (§3):** low ≤ 120 calls / 250 k tris, medium ≤ 180 / 500 k, high ≤ 260 / 1.2 M. The harness runs at the end of Task 1 (re-baseline) and in the Ship task.
- **One sun + one moon + hemisphere, always.** No new `PointLight`. Glow = shader term.
- Spanish player-facing text (this plan adds none).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] The triangle hog is `ResourceMeshes`** (profiled with the new `--top`: trees 147 k + 84 k + 84 k, bushes 78 k + 39 k, rocks 17 k, grass 15 k on low — all `frustumCulled = false` over the whole map). Instead of the spec's 4×4 regions (more draw calls), **re-pack each `InstancedMesh` with only the instances within `drawDistance × 0.9` of the camera and not > 20 m behind it**, re-packed only after the camera moves 6 m or turns 0.3 rad (`NearInstances`). Past `drawDistance × 0.8` the fog is opaque, so nothing visible is lost. Draw calls go *down*: trunk + 2 crowns merge into one vertex-coloured geometry, bush + berries too (6 → 3 meshes). Grass tufts use the same class with a 70 m radius (0.9 m tufts are specks beyond).
- **[D] Harness filters:** `--stop a,b` and `--top` (prints the 12 biggest meshes per reading from `window.__perf.top()`).
- **[D] Biomes for the look:** bosque, costa, pantano, montanas, tierras (Tierras Corruptas = `inCorrupt`). Purified look waits for V2-C (spec §11). Blend: the look at a point = average of the biome at the point and 4 points 15 m away (≈ 30 m blend), plus a 1 s time smoothing in the client.
- **[D] Hours:** 4 keys per look (noche 0.0, alba 0.25, dia 0.5, ocaso 0.75) interpolated on the day fraction (cyclic), matching the sun already in `DayLight` (sunrise 0.25).
- **[D] Night:** horizon ≤ 0x0c1220-ish, zenith 0x05080f, hemisphere 0.08, moon 0.35 bluish (spec §4). Raid, storm and swamp tints stay as today, applied on top of the look.
- **[D] Dome:** sphere 16×12 (≈ 350 tris), radius = 0.9 × far, follows the camera, `fog: false`, `depthWrite: false`, `renderOrder -1`. Clouds: FBM painted once into a 256² (512² on high) canvas texture, sampled on the dome and scrolled; `clouds` 0/1/2 from `TierSettings`. Stars (high): hash in the dome shader, faded by `1 − daylight`. `scene.background` keeps the horizon colour (seen under water and before the dome loads).
- **[D] Fog:** low keeps `THREE.Fog` linear. Medium/high: same near/far but the factor is thinned with height above the valley floor (clamped so everything past `far` is still fully fogged — no popping at the re-pack radius) and tinted toward the sun colour when looking at the sun (cheap scattering).
- **[D] Glow:** `uniform vec4 glowPos[8]; vec4 glowCol[8]` shared by every patched material; `glowPoints` slots (4 low / 8 medium, high); sources = lit fogatas + the Corazón, nearest to the player. Adds `col · (1 − d/r)² · diffuse` before fog. Strength scaled by `1 − daylight × 0.7` so fires matter at night.
- **[D] Shadow discs** on low (no shadow map): one shared circle geometry and material under every 3D actor (players, wolves/brutes) — paper actors already have one.

## File Structure

- Create `src/client/scene/near-instances.ts` (+test), `src/client/scene/looks.ts` (+test), `src/client/scene/sky-dome.ts`, `src/client/scene/patches.ts` (+test for the pure glow picker).
- Modify `scripts/perf/run.mjs`, `scripts/perf/baseline.json`, `src/client/perf-hook.ts`, `src/client/scene/vegetation.ts`, `src/client/scene/sky.ts`, `src/client/scene/terrain-mesh.ts` (material hook only), `src/client/actors/actor.ts`, `src/client/game.ts`.

## Tasks

### Task 1: perf — draw only what is near (before/after baseline)

```ts
export class NearInstances {
  constructor(meshes: THREE.InstancedMesh[], matrices: THREE.Matrix4[]);
  setHidden(i: number, hidden: boolean): void;
  update(cx: number, cz: number, radius: number, fwd: { x: number; z: number } | null): boolean; // true = re-packed
}
```

- [x] **Step 1:** harness `--stop`, `--top`; `window.__perf.top(n)`; profile low bosque/tierras → hogs listed above.
- [x] **Step 2: failing tests** (`near-instances.test.ts`): radius filter; drops > 20 m behind but keeps just behind; hidden skipped and restored; no re-pack for a 3 m move, re-pack after 20 m; several meshes share one list.
- [x] **Step 3: implement**; `ResourceMeshes` merges geometries (vertex colours) and uses it; `buildGrass` returns `{ mesh, near }`; `game.ts` `packNear()` each frame after the camera rig.
- [x] **Step 4:** green; harness on low bosque + screenshot (trees still to the fog); full `npm run perf -- --update`; before/after in the HANDOFF. Commit `perf(visuales): árboles, rocas, arbustos y hierba solo cerca de la cámara`.

### Task 2: `BiomeLook` table (pure)

```ts
export type Biome = 'bosque' | 'costa' | 'pantano' | 'montanas' | 'tierras';
export interface LookKey { zenith: number; horizon: number; fog: number; sun: number; sunI: number; hemiSky: number; hemiGround: number; hemiI: number; moonI: number; }
export const LOOKS: Record<Biome, { noche: LookKey; alba: LookKey; dia: LookKey; ocaso: LookKey }>;
export function biomeOf(x: number, z: number): Biome;
export function biomeWeights(x: number, z: number): Partial<Record<Biome, number>>; // sums to 1
export interface Look { zenith: THREE.Color; horizon: THREE.Color; fog: THREE.Color; sun: THREE.Color; sunI: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number; moonI: number; }
export function lookAt(w: Partial<Record<Biome, number>>, frac: number, out?: Look): Look;
```

- [x] **Step 1: failing tests** (`looks.test.ts`): every biome has 4 keys; night is dark (zenith luminance < 0.02, hemiI ≤ 0.1, moonI ≈ 0.35) and day is bright; `lookAt` at the key hours equals the key; midway is between; wraps 0.99 → 0.0 smoothly; `biomeOf` for the harness stops (bosque (0,60), costa (0,275), pantano (−340,160), montañas (20,−300), tierras (0,−560)); weights sum to 1 and blend near a border; pantano sun weaker than costa's.
- [x] **Step 2: implement** with the colours of spec §4. **Step 3:** green, commit `feat(visuales): tabla BiomeLook por bioma y hora (puro)`.

### Task 3: sky dome and the look in `DayLight`

- [x] **Step 1:** `sky-dome.ts` (`SkyDome(tier)`, `update(camPos, look, sunDir, daylight, t)`), clouds canvas texture on medium/high, stars on high.
- [x] **Step 2:** `DayLight.update` takes the look: background/fog = horizon/fog colour, sun colour/intensity, hemi colours/intensity, moon; raid/storm/swamp tints on top; the dome is updated from it. `game.ts` computes weights + 1 s smoothing.
- [x] **Step 3:** green; harness low + medium on bosque (+1 call, dome tris) and screenshots day/night. Commit `feat(visuales): cúpula con sol, nubes y estrellas; luz por bioma y noches oscuras`.

### Task 4: height fog and glow points (shader patch)

```ts
export function pickGlows(sources: readonly GlowSource[], x: number, z: number, n: number): GlowSource[]; // nearest n
export function patchWorld(mat: THREE.Material, opts: { heightFog: boolean; glow: number }): void;
```

- [x] **Step 1: failing tests** (`patches.test.ts`): `pickGlows` returns the n nearest, fewer if fewer exist, empty for n = 0; `patchWorld` sets `onBeforeCompile` and a distinct `customProgramCacheKey` per option set; the injected chunk replaces `#include <fog_fragment>` (checked on a fake shader object).
- [x] **Step 2: implement**; apply to terrain, resources, grass, crags, pines/thorns; uniforms updated once per frame from lit fogatas + the Corazón.
- [x] **Step 3:** green; harness bosque/montañas at night with shots. Commit `feat(visuales): niebla por altura y puntos de brillo sin luces`.

### Task 5: shadow discs on low

- [x] **Step 1:** `Actor` gets an optional disc (shared geometry/material, `depthWrite: false`, just above the ground); `game.ts` enables it when the tier has no shadows.
- [x] **Step 2:** green; low screenshot. Commit `feat(visuales): disco de sombra bajo los actores en gama baja`.

### Task 6: Ship

- [x] Full harness `npm run perf` (all within budget or not worse than the new base); `--update` if the dome/discs added their expected cost; HANDOFF "## Visuales · V2-B — …" with before/after table, decisions, what to test on a phone; push; one short comment on PR #3.
