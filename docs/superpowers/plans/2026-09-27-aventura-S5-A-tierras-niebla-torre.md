# Aventura — Slice 5 · S5-A: las Tierras Corruptas, la niebla del dragón y la torre del horizonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the last rectangle of the map. A 480 × 200 m band north of the mountains (`|x| < HALF`, `−HALF − 420 < z < −HALF − 220`): **el Borde** (the mountains' +90 rim falling to +20, smooth), **la Ceniza** (grey ash plain), **el Espinar** with the **Lago Negro** basin (west) and the **Escalones rotos** (east, 4 smooth 6 m steps), and **la Torre**'s plateau (+30, `|x| < 30`). The S4-G fog wall becomes a **gate**: a dragon rider touching it with the 4 Raíces-madre purified opens it for the world (`fogOpen`); otherwise it names the missing one. Nobody crosses the rim line on foot or on a land mount. **El Marchito's tower** stands on the plateau and is seen from the whole map through one cheap "sky" copy; it grows +1 m per game day (60 → 140 m).

**Architecture:** `terrain.ts` gains `CORRUPT_LANDS`, `corruptDepth`, `inCorrupt`, `corruptFeatures(seed)` (lake, steps) and a `corrupt(x, z)` height branch for `z < −HALF − 220`, built on the same `E(x)` as the mountains so the seam at `z = MOUNTAINS.z0` is continuous (`mountains(x, z0) = E + 90`). Bounds become the union of 4 rectangles. A new `src/shared/corrupt-lands.ts` holds the gate/tower rules (`RIM_LINE`, `rimCrossBlocked`, `missingRoot`, `towerHeight`, `TOWER`). `mountains.ts`'s `smoothAt`/`steepBlocked` also apply inside `inCorrupt`. `dragon.ts`'s `inFog(z, open)` takes the gate state. Server: `SavedWorld.fogOpen?`, `towerDay0?`; snapshot `fogOpen`, `towerH`. Client: 4 corrupt chunks (detail/silhouette like the mountains, hidden while you're south of the mountains' midline and not flying), the fog plane fades when open and a second one marks the north edge, and `scene/villain-tower.ts` draws the real tower near and a scaled sky copy far.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §3.1–3.3, §14 (names), §16.1–16.3, §17 row S5-A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Every proper name through `NAMES` (all of spec §14 added now; the names test forbids hand-written `Corruptas`, `Flecha`, `Guardián`, `Estrella`).
- **Phones first. Touch grid stays at 10 pills.** This plan adds no action (flying is S4-G's).
- **Trust boundary:** the server decides the gate (`fogOpen`), the rim line and the steep rule; the client mirrors the pure functions.
- **Protocol:** Task 3 bumps `PROTOCOL_VERSION` 43 → 44 (terrain + `fogOpen`/`towerH` in the snapshot). New saved fields optional: old saves load with the Tierras behind the fog; `towerDay0` is set on load to today.
- **Old worlds:** terrain for `z ≥ −HALF − 220` is identical.
- **Out of this plan:** thorns (Zarzal damage), the lake's water, pillars, fogata 6, rayos, zones 18–21, la Grieta, tower cracks/white swap, the dungeon. The lake is only a dry basin now (**Decidido por Claude:** its local water level comes with its pillar in S5-C, where the fish needs it).
- **Mobile performance:** corrupt detail chunks ×1 columns (they meet the mountains' rim), rows ×1 in el Borde and on the Escalones riser edges, ×2 beyond; 16 × 16 silhouettes; chunks hidden entirely from the forest/coast/swamp (**0 extra draw calls there**), +4 when north. Sky tower: **+1 draw call** everywhere; the real tower +1 within 300 m. Report vertex counts.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Corrupt Lands terrain, 4-rectangle bounds and names

**Files:** Modify `src/shared/terrain.ts`, `src/shared/names.ts`, `src/shared/names.test.ts`; Create `src/shared/corrupt-lands.test.ts` (terrain part).

**Interfaces:**
```ts
// terrain.ts
export const CORRUPT_LANDS = { x0: -HALF, x1: HALF, z0: -HALF - 420, z1: -HALF - 220, rim: 20, ceniza: 80, espinar: 170, sideRim: 15, rimTop: 90, rimFoot: 20 } as const;
export const TOWER_FOOT = { half: 30, d: 170, top: 30, blend: 6 } as const;           // plateau |x| < 30, d ≥ 170, E + 30
export interface Basin { x: number; z: number; r: number; depth: number }             // el Lago Negro (dry in S5-A)
export interface Steps { x: number; d0: number; half: number; steps: 4; rise: 6; pitch: 8; run: 1.5; top: number } // los Escalones rotos
export function corruptDepth(z: number): number;   // d = (−HALF − 220) − z
export function inCorrupt(x: number, z: number): boolean;
export function corruptFeatures(seed: number): { lake: Basin; steps: Steps };
// names.ts: biomeCorrupt, rim, ash, thornland, blackLake, brokenSteps, villainTower, treeTower, rootPillar, lieutenant3,
//           flier, blackHeart, guardian, legendary, thorn, crack, challengeNights, credits
```
- [ ] **Step 1: failing tests.**
  - `heightAt` for `z ≥ −HALF − 220` unchanged: snapshot of heights (2 seeds, points in forest, mountains incl. d = 219.9) taken before the change.
  - Seam: `|h(x, z0 − 0.01) − h(x, z0 + 0.01)| < 0.2` for 20 x (z0 = `MOUNTAINS.z0`).
  - Borde: `h(x, d = 0.5) ≥ E + 85`, `h(x, d = 22) ≤ E + 30`; mean slope across the band > 60°.
  - Ceniza (d 25–75, away from the lake/steps/sides): all between E + 10 and E + 30.
  - Lake: centre ≥ 9 m below its rim (r 40); centre in `x < −60`, d 100–150. Steps: in `x > 60`, d0 110–120; 4 risers of 6 ± 0.3 m, top = base + 24 ± 0.5, flat tops.
  - Plateau: `max − min < 0.5` inside `|x| < 24`, d 176–198; `≈ E + 30`.
  - Side rims: `x = ±(HALF − 2)` at d 100 is ≥ 40 m above `x = ±(HALF − 40)`.
  - Bounds: `inMap(0, −HALF − 300, 2)` true; `inMap(0, −HALF − 219.5, 2)` true (seam); `clampMap(0, −HALF − 900, 3)` → `z = CORRUPT_LANDS.z0 + 3`; all old clamp cases hold.
  - `names.test.ts` forbids `Corruptas|Flecha|Guardián|Estrella`.
- [ ] **Step 2: implement.** `heightAt`: `x ≥ −HALF && z < MOUNTAINS.z0` → `corrupt(x, z)` = `E(x) + r`: Borde `lerp(90, 20, smooth(d/20))`; beyond, `20 + (fbm − 0.5)·10` ramped over 8 m; Espinar (d > 80) `+ 8·smooth((d − 80)/40) + (fbm − 0.5)·16`; basin `min(h, rimH − depth·(1 − k²))` inside r; steps `base + Σ rise·smooth((d − d0 − pitch·k)/run)` inside `|x − sx| < half` (1.5 m side walls, back wall at `d0 + 40`); plateau `lerp(h, E + 30, smooth(...))`; side rims `lerp(r, 90, smooth(side/15))`. Features from `createRng(seed ^ 0xc0770)`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): las Tierras Corruptas en el mapa (Borde, Ceniza, Espinar, Lago Negro, Escalones, meseta)`.

### Task 2: Walking rules — the rim line, smooth rock and steep slopes up north

**Files:** Create `src/shared/corrupt-lands.ts`; Modify `src/shared/mountains.ts`, `src/shared/sim/world-sim.ts`, `src/client/movement.ts`; Tests `corrupt-lands.test.ts`, `mountains.test.ts`, `world-sim.test.ts`, `movement.test.ts`.

**Interfaces:**
```ts
export const RIM_LINE = -HALF - MOUNTAINS.rimFrom;                              // the old fog wall (z)
export const RIM_TEXT = 'El Borde no se baja a pie. Solo volando';
/** A move on the ground/land mount crossing the rim line northward. Flying never calls it. */
export function rimCrossBlocked(pz: number, nz: number): boolean;
// mountains.ts: smoothAt also true in inCorrupt for d < rim (el Borde) and on the Escalones rotos (risers and tops);
//               steepBlocked applies when the end is inMountains || inCorrupt.
```
- [ ] **Step 1: failing tests.** `rimCrossBlocked(RIM_LINE + 1, RIM_LINE − 0.5)` true, reverse false, both north false. `smoothAt` on the Borde and a riser of the Escalones true, on la Ceniza false. `steepBlocked` from the Escalones' foot onto riser 1 true. Server: a walker moving across the rim line is fixed with the hint; a deer rider the same; a walker already in la Ceniza walking around is accepted; a frog rider jumping onto the Escalones is accepted (frog exempt, as in S4). Client `stepBody`: walking north at the rim line stops.
- [ ] **Step 2: implement.** `onMove`: before the steep check, `if (rimCrossBlocked(p.z, m.z)) { hint RIM_TEXT; fix }` (walk, deer, fish, frog, glide). `movement.ts` mirrors it in the ground step (toast via the existing steep-result channel, kind `'rim'`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el Borde solo se cruza volando`.

### Task 3: The fog gate, the tower's growth, save + snapshot (protocol v44)

**Files:** Modify `src/shared/corrupt-lands.ts`, `src/shared/dragon.ts`, `src/shared/sim/world-sim.ts`, `src/shared/sim/marchito.ts` (VISION), `src/shared/protocol.ts`, `src/client/movement.ts`, `src/client/game.ts`; Tests `corrupt-lands.test.ts`, `dragon.test.ts`, `world-sim.test.ts`, `protocol.test.ts`.

**Interfaces:**
```ts
export const TOWER = { x: 0, z: -HALF - 400, base: 60, grow: 1, max: 140, r: 14 } as const;
export function towerHeight(day: number, day0: number): number;               // 60 + min(80, max(0, day − day0))
export function missingRoot(p: { purified: boolean; purified2: boolean; purified3: boolean; purified4: boolean }): string | null; // name of the first missing
export function fogText(missing: string): string;                              // "La niebla aguanta. Falta la …"
// dragon.ts: inFog(z, open = false): open ? z < CORRUPT_LANDS.z0 + 2 : z < RIM_LINE
// SavedWorld: fogOpen?: boolean; towerDay0?: number.   snap: fogOpen: boolean; towerH: number.
```
- [ ] **Step 1: failing tests.** `towerHeight(5, 5) = 60`, `(45, 5) = 100`, `(500, 5) = 140`. `missingRoot` order Bosque → Costa → Pantano → Montaña, null when all 4. Server: a dragon rider flying into `z < RIM_LINE` with 3 purified is fixed and hinted "…Falta la Raíz-madre de la Montaña"; with all 4, the move is accepted, `fogOpen` saves, a vision is sent with the rider's name, and a later flight to `z = −HALF − 350` is accepted; the north edge still refuses. Old save without the fields: `fogOpen` false, `towerDay0` = today; snapshot carries `fogOpen` and `towerH`. `PROTOCOL_VERSION` 44 (existing assertions updated: intentional bump).
- [ ] **Step 2: implement.** `onFly`: `if (!this.fogOpen && inFog(m.z))` → all 4 purified ? open (+ vision «Ya vienes. Bien. Te espero arriba, <nombre>.») : hint + fix. Client flight uses `inFog(z, snap.fogOpen)`; `game.ts` keeps `fogOpen`/`towerH` from the snapshot.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la niebla se aparta ante un jinete con las 4 Raíces-madre (protocolo v44)`.

### Task 4: Client — corrupt chunks, colours and the fog planes

**Files:** Modify `src/client/scene/terrain-mesh.ts`, `src/client/scene/dragon.ts`, `src/client/game.ts`; Test `terrain-mesh.test.ts`.

**Interfaces:**
```ts
export function corruptChunks(segments: number): MountainChunk[];               // 4 chunks tiling CORRUPT_LANDS
export const CORRUPT_SHOW_Z = -HALF - 110;                                       // chunks drawn only north of this (or flying)
export function corruptVisible(z: number, flying: boolean): boolean;
// DragonMeshes.setFog(open): the gate plane fades out; a second plane stands at the north edge.
```
- [ ] **Step 1: failing tests.** Chunks tile `CORRUPT_LANDS` exactly; detail columns = the mountains' (seam); rows ≤ cell in d < 24, include each Escalones riser edge, ≤ 2·cell beyond; silhouettes 16 × 16; `corruptVisible` false in the forest on foot, true flying anywhere and north of `CORRUPT_SHOW_Z`. Log vertex counts per tier and assert an upper bound.
- [ ] **Step 2: implement.** Colours: ash grey (`0x8a8580` ↔ `0x6e6a66` by density), smooth dark slate on el Borde and the Escalones, charred brown in the lake basin, violet-black plateau. `game.ts` adds the 8 meshes, toggles detail/silhouette per chunk and the group by `corruptVisible` (only on change).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de las Tierras Corruptas (trozos, colores, niebla)`.

### Task 5: Client — the tower on the horizon

**Files:** Create `src/client/scene/villain-tower.ts`, `villain-tower.test.ts`; Modify `src/client/game.ts`.

**Interfaces:**
```ts
export const TOWER_NEAR = 300;
/** Where to draw the sky copy: along the real direction, at `dist` (< far), scaled so the angular size matches. */
export function skyPlacement(cam: { x: number; y: number; z: number }, base: { x: number; y: number; z: number }, dist: number): { x: number; y: number; z: number; scale: number };
export class VillainTower { readonly group; constructor(terrain: Terrain); update(cam: THREE.Vector3, height: number, far: number): void }
```
- [ ] **Step 1: failing tests.** `skyPlacement`: the placed point lies on the ray cam → base; `scale = dist / realDist`; the top's angle from the camera matches the real top's (±0.1°). `VillainTower.update`: within 300 m only the real mesh is visible, beyond only the sky copy; the height scales both.
- [ ] **Step 2: implement.** A twisted cone (`ConeGeometry(14, 1, 12, 8)`, vertices twisted by height, unit height scaled on y), dark purple Lambert + violet emissive tip. Sky copy: `MeshBasicMaterial` `fog: false`, `depthWrite: false`, `renderOrder = −1` (drawn first, so terrain covers its base), placed at `0.9 · far`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la torre de El Marchito se ve desde todo el mapa y crece cada día`.

### Task 6: Ship

- [ ] Push `aventura/resto`; append "Slice 5 · S5-A" to `docs/superpowers/HANDOFF-aventura.md` (commits, tests, decisions, perf numbers, qué probar); one short comment on PR #3. No merge, no deploy.
