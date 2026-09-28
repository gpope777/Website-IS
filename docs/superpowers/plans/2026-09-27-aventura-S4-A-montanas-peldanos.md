# Aventura — Slice 4 · S4-A: las Montañas, los Peldaños y la regla de la pendiente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the north of the map. A 480 × 220 m mountain range (`|x| < HALF`, `−HALF − 220 < z < −HALF`) grows beyond the forest's north rim: **los Peldaños** (4 smooth terraces of +6 m over a 1.5 m riser), the **Faldas** (noise + 9 seeded **paredes**, steep mesas of 12–25 m), the **Cumbre** (ridge noise up to ~+75), **el Pico** (a flat 12 m disc at +80), a shallow **snow chute** down the middle and cliff rims. A new rule, only inside the mountains: **you can't walk (or ride) uphill on a cell steeper than 45°**. The frog's high jump is the way up the Peldaños. The client draws the mountains in 4 chunks with a low-poly silhouette beyond 160 m.

**Architecture:** `terrain.ts` gains `MOUNTAINS`, `PELDANOS`, `inMountains`, `mountainFeatures(seed)` (paredes + Pico) and `heightAt` picks the mountains for `z < −HALF` (`x ≥ −HALF`), built on top of `E(x) = forest height at z = −HALF` so the seam is continuous and nothing at `z ≥ −HALF` changes. `inMap`/`clampMap` become the union of 3 rectangles (forest+coast, swamp, mountains; 1 m overlap at the seams). Rules live in a new `src/shared/mountains.ts` (`STEEP`, `slopeAt`, `smoothAt`, `steepBlocked`), used by `WorldSim.onMove` and `client/movement.ts` next to `zarzalAt`/`inCienaga`. Crags skip the forest's northern 60 m.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §3.1–3.3, §13 (names), §15.1, §15.3 (protocol), §15.4 (perf), §15.5 (risks), §16 row S4-A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Every proper name through `NAMES`.
- **Phones first. Touch grid stays at 10 pills.** This plan adds no action (the frog's B already jumps).
- **Trust boundary:** the server validates the steep rule (tolerance 50° vs the client's 45°) and the new bounds; the client mirrors the same pure functions.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 31 → 32 (the terrain changed: client and server must agree). No new saved fields: old saves load.
- **Old worlds:** terrain for `z ≥ −HALF` is identical. Crags in the forest's northern 60 m (`z < −HALF + 60`) disappear (no gliding onto the terraces); a shrine or zone that sat on one may move.
- **Out of this plan:** climbing terrain (S4-B), weather/cold, the Escalera ramp (S4-F), cave, quartz, refugios, pines as resources. The steep rule only *refuses*; `smoothAt` is exposed now for S4-B.
- **Mobile performance:** mountain detail chunks at ×1 columns (they must meet the forest mesh at the seam), fine rows in the Peldaños (plus a row at each riser edge), ×2 rows beyond. 4 chunks, each shows detail within 160 m of the player or a 16 × 16 silhouette otherwise: **+4 draw calls** always, +1 for decorative instanced pines. Report vertex counts per tier.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Mountain terrain, 3-rectangle bounds, crag exclusion and names

**Files:** Modify `src/shared/terrain.ts`, `src/shared/crags.ts`, `src/shared/names.ts`, `src/shared/names.test.ts`; Create `src/shared/mountains.test.ts` (terrain part); Tests `crags.test.ts`.

**Interfaces:**
```ts
// terrain.ts
export const MOUNTAINS = { x0: -HALF, x1: HALF, z0: -HALF - 220, z1: -HALF, faldas: 40, cumbre: 120, rimFrom: 200, rimTop: 90, sideRim: 20 } as const;
export const PELDANOS = { steps: 4, rise: 6, run: 1.5, pitch: 10, first: 1 } as const;  // riser k spans d ∈ [first + pitch·k, +run]
export const PICO = { d: 170, r: 6, skirt: 25, rise: 80 } as const;
export interface Pared { x: number; z: number; top: number; rt: number; w: number; h: number } // mesa: flat top radius rt, face width w, height h
export function mountainDepth(z: number): number;                        // d = −HALF − z (metres north of the rim)
export function inMountains(x: number, z: number): boolean;
export function mountainFeatures(seed: number): { paredes: Pared[]; pico: { x: number; z: number } };
// inMap / clampMap: union of the 3 rectangles; clampMap → nearest rectangle.
// names.ts: biomeMountains, mountainRoot, mountainGate, stairs, peak, bossMountain, eliteMountain, lieutenant2,
//           powerStone, dragon, dragonWild, quartz, refugio, tower
```
- [ ] **Step 1: failing tests.**
  - `heightAt` for `z ≥ −HALF` is unchanged: a snapshot of 60 heights (3 seeds, fixed points in forest, coast and swamp) recorded *before* the change must still match.
  - Seam: `|heightAt(x, −HALF − 0.01) − heightAt(x, −HALF + 0.01)| < 0.1` for 20 x.
  - Peldaños: at each riser k the height climbs 6 ± 0.2 m between `d = 1 + 10k − 0.2` and `d = 2.5 + 10k + 0.2`; terrace tops are flat in d (`|h(d) − h(d + 5)| < 0.3` on each top); the 4th top is `E + 24`.
  - Faldas start at `E + 24` and are on average 30–45 over E; 8–10 paredes, inside `d ∈ [50, 115]`, `|x| < HALF − 40`, not within 12 m of the chute (`|x| < 4`), not overlapping; each face's max slope 50–76°.
  - Pico: 12 m flat disc (`max − min < 0.5` inside r 6), 75–85 m above E at its x.
  - Rims: `d = 215` is ≥ E + 80; x = ±(HALF − 3) at d = 100 is ≥ 40 m above the same z at x = ±(HALF − 40).
  - `inMap(0, −HALF − 100, 2)` true; `inMap(−HALF − 10, −HALF − 10, 2)` false; `inMap(0, −HALF − 0.5, 2)` true (seam walkable); `clampMap(0, −HALF − 400, 3)` → `{ x: 0, z: MOUNTAINS.z0 + 3 }`; old swamp clamp cases still hold.
  - No crag with `z < −HALF + 60`.
  - `names.test.ts` also forbids hand-written `Montañas`, `Peldaños`, `Cucurucho`.
- [ ] **Step 2: implement.** `heightAt`: `x ≥ −HALF && z < −HALF` → `E(x) + profile(x, d)`: terraces `6 · Σ smooth((d − first − 10k)/run)`, then Faldas `24 + 16·smooth((d − 40)/80) + noise` (ramped in over 8 m), paredes `+ h·smooth((rt + w − dist)/w)`, Cumbre `+ 25·smooth((d − 120)/80) + ridge noise`, the Pico disc (absolute top `E(pico.x) + 80`, skirt 25 m), the chute (`−2 m` within `|x| < 4`, 6 m blend, `d ≥ 40`), rims (north `d > 200`, sides `|x| > HALF − 20` only for `d ≥ 40`, ramped). Paredes: 9 seeded mesas, `h` 12–25, angle 50–75°, `w = max(8, 1.5h / tan(angle))`. Add the §13 names.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): las Montañas en el mapa (Peldaños, Faldas, paredes, Cumbre, Pico)`.

### Task 2: Steep-uphill rule on the server (protocol v32)

**Files:** Create `src/shared/mountains.ts`; Modify `src/shared/sim/world-sim.ts`, `src/shared/protocol.ts`; Tests `mountains.test.ts`, `world-sim.test.ts`, `protocol.test.ts`.

**Interfaces:**
```ts
export const STEEP = { deg: 45, serverDeg: 50, probe: 1 } as const;
export function slopeAt(t: Terrain, x: number, z: number): number;          // degrees, central difference over 1 m
export function smoothAt(x: number, z: number): boolean;                      // los Peldaños (no grip; S4-B uses it)
export function steepBlocked(t: Terrain, px: number, pz: number, nx: number, nz: number, deg?: number): boolean;
// true iff the end is inMountains and some ≤ probe-metre step along the segment rises onto a cell steeper than `deg`
```
- [ ] **Step 1: failing tests.**
  - `slopeAt` ≈ 0 on a terrace top, > 70 mid-riser, < 30 on most Faldas points outside paredes (≥ 85 % of 300 samples), > 50 on a pared face.
  - `smoothAt` true on the Peldaños band, false in the Faldas and the forest.
  - `steepBlocked`: forest → mid first riser: true; mid riser → forest (downhill): false; along a terrace top: false; walking up a gentle Faldas slope: false; any move with the end outside the mountains: false; with `deg = 89` nothing is blocked.
  - Server: a walker at `(0, −HALF + 0.5)` sending a move onto the second terrace top is rejected (fix), and gets the hint "Roca lisa. Sin agarre"; a deer rider pushing up a pared face is rejected with "El ciervo no trepa"; walking down a riser is accepted; a frog rider jumping from the foot onto terrace 1 (y ≤ ground + 13) is accepted; a walker walking north across the seam at `z = −HALF + 1 → −HALF − 0.5` onto flat ground is accepted.
  - `PROTOCOL_VERSION` is 32 (existing assertions updated: intentional bump).
- [ ] **Step 2: implement.** In `onMove`, after the existing checks: `const steep = !l.frog && m.y < ground + 0.6 && steepBlocked(this.terrain, p.x, p.z, m.x, m.z, STEEP.serverDeg)`; reject and hint (`smoothAt` → "Roca lisa. Sin agarre", riding → "El ciervo no trepa", otherwise "Demasiado empinado"). Frog riders are exempt on the server (the high jump crosses risers; their ground+13 ceiling still applies).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la pendiente de más de 45° no se sube en las Montañas (protocolo v32)`.

### Task 3: Client movement in the mountains

**Files:** Modify `src/client/movement.ts`, `src/client/game.ts`; Test `src/client/movement.test.ts`.

- [ ] **Step 1: failing tests.** `stepBody` on foot pushing north at the foot of the Peldaños stays below the first terrace (after 3 s, `y < E + 1`) and `result.steep` is `'smooth'`; walking back south moves; on the deer the same (`'deer'`); on the frog on the ground it's blocked, but B (jump) from the foot lands on terrace 1 and four jumps reach the Faldas; the map clamp lets you walk from `z = −HALF + 3` to `z = −HALF − 0.5` at an x where the forest meets the first terrace floor.
- [ ] **Step 2: implement** with the shared `steepBlocked` (client `STEEP.deg`): walkers and deer when `heightAt(to) > b.y`; the frog only while on the ground. `StepResult.steep?: 'smooth' | 'deer' | 'steep'`; `game.ts` shows a throttled local toast (same texts as the server, every 3 s at most).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): moverse por las Montañas en el cliente`.

### Task 4: Client — mountain chunks, silhouette, colours and pines

**Files:** Modify `src/client/scene/terrain-mesh.ts`, `src/client/game.ts`; Test `terrain-mesh.test.ts`.

**Interfaces:**
```ts
export interface Patch { x0; x1; z0; z1; segX; segZ; rows?: number[] }          // rows: explicit z list (overrides segZ)
export interface MountainChunk { detail: Patch; silhouette: Patch }
export function mountainChunks(segments: number): MountainChunk[];              // 4 chunks of 120 m in x
export const MOUNTAIN_LOD = 160;                                                  // detail within this many metres
export function chunkDetailed(c: MountainChunk, x: number, z: number): boolean;
export function buildPines(terrain: Terrain, seed: number, count?: number): THREE.InstancedMesh; // Faldas, decorative, one draw call
```
- [ ] **Step 1: failing tests.** 4 chunks tile `MOUNTAINS` exactly; detail columns match the forest near patch's cell size; detail rows include every riser edge (`d = 1 + 10k`, `1 + 10k + 1.5`) and are ≤ cell apart in the Peldaños, ≤ 2·cell beyond; silhouette is 16 × 16; `chunkDetailed` true at the chunk's centre and 150 m south of its edge, false 170 m away. Log (and assert an upper bound on) the vertex count per tier.
- [ ] **Step 2: implement.** `buildTerrainMesh` honours `rows` (a custom-row plane). Colours: smooth grey Peldaños (`smoothAt`), rock where `slopeAt > 45`, snow above `d ≥ 150` (blend over 20 m) and on the Pico, pale packed snow on the chute, else mountain grass. Game: add the 8 meshes, toggle `visible` per chunk each frame from the player position (only on change); tint only the detail meshes. Pines: ~150 instanced cones on Faldas cells with slope < 30°, away from the chute.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de las Montañas (trozos con silueta, colores, pinos)`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 4 · S4-A" to `docs/superpowers/HANDOFF-aventura.md` (commits, tests, decisions, perf numbers, qué probar); one short comment on PR #3. No merge, no deploy.
