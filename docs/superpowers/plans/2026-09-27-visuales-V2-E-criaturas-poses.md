# Visuales · V2-E: Criaturas, poses, luz en el papel y "suelta y listo" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row V2-E of the spec's plan map (§14), the last plan of #2. (1) **Procedural low-poly deer, fish, frog and whale** (one mesh / one draw call each, vertex colours, "fake bones" rotated in the vertex shader by a per-vertex `part` attribute) replacing the boxes, with the same `sync` APIs. (2) **A colour per enemy type** on the fox-model enemies (one shared material per type, not per instance) and a **ground marker for the charge** of the dungeon brutes. (3) **Code-driven bone poses** for roll, block, bow, climb, glide and slide over the closest robot clip, and a leaf-cloth glider that sways with the wind instead of the cone. (4) **Better light on the paper drawings** (the look's sun/hemisphere colour, a white paper border on medium/high) and a **moonlit rim on actors at night** (V2-B: the robot on the coast at night was a near-black silhouette). (5) **The model loader with procedural fallback** for the §9 drop-ins: `deer/fish/frog/whale/wolf/brute.glb` used when present, procedural/fox when absent.

**Architecture:** pure data/maths in `src/client/scene/creature-rig.ts` (low-poly builders returning position/colour/part arrays, per-creature pivots, pose functions from phase/speed/state; +test), `src/client/actors/poses.ts` (bone offsets per anim and time; +test), `src/client/actors/enemy-look.ts` (colour/scale/emissive per enemy type and biome, which elite is charging; +test) and `src/client/actors/drop-ins.ts` (the §9 table, response check; +test). `scene/patches.ts` stays the only `onBeforeCompile` module: `patchRig` (fake bones), `patchRim` (moonlit rim) and `patchPaper` (lit paper + border). `steeds.ts`, `fish.ts`, `frog.ts`, `whale.ts` keep their classes and signatures; `actor.ts` gains `setSkin` and the poses; `paper.ts` gains the light; `models.ts` the optional loader; `game.ts` wires it.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, harness `npm run perf` (V2-A..D).

**Spec:** `docs/superpowers/specs/2026-09-27-visuales-design.md` §4 (noche de verdad: rim), §6.1–6.4, §9, §14 (V2-E).

## Global Constraints

- **No gameplay/collision/protocol change.** `PROTOCOL_VERSION` stays 62. Nothing new is sent or saved. Mount heights (`MOUNT.height`, `FISH.height`, `FROG.height`, `WHALE.height`), attack/charge timings and hitboxes are untouched: the creatures are redrawn to the same size, the charge marker only shows what the server already sends (`elite.charging`).
- **Budgets (§3):** low ≤ 120 calls / 250 k tris, medium ≤ 180 / 500 k, high ≤ 260 / 1.2 M. Tightest today: medium bosque 156 / 437 k. The creatures go from 9–19 boxes (one call each) to 1 call each: calls only go down. Triangles: deer ≤ 900, fish ≤ 500, frog ≤ 700, whale ≤ 1 200.
- No new lights, no vertex-texture fetch, no downloads, no post-processing, no new textures (the paper border reads the drawing's own texture).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Fake bones = a `part` float attribute + `uniform vec3 rigPivot[8]` + `uniform vec3 rigRot[8]`** (Euler X·Y·Z per part) + `uniform vec3 rigWave` (amplitude, spatial frequency, phase: a sideways S-bend along the body for fish and whale), applied in `begin_vertex`/`beginnormal_vertex` of a `MeshLambertMaterial({ vertexColors, flatShading })`. Parts: 0 body, 1–4 legs (front L/R, back L/R), 5 tail, 6 head/neck, 7 fin/throat. One material per creature instance (a clone: same program, own uniforms). Everything else on the material (fog, glow, rim) stacks through `addPatch`.
- **[D] Builders** merge simple primitives (lathe bodies, tapered cylinders for legs, extruded antler branches, flat fins) with `mergeGeometries`, non-indexed, each piece stamped with its part and colour. Same sizes as the boxes they replace (the rider's seat heights come from `shared` and do not move).
- **[D] Motion** (pure functions → the 8 rotations): deer trot/gallop leg phase (diagonal pairs), head bob with speed, grazing when still, buck on taming; fish S-wave by the tail faster with speed, thrash when calmed; frog legs folded, extended while moving (hop), throat pulse when wild; whale slow S-wave, tail fluke up/down, spout as today.
- **[D] Enemy looks** from `enemyLook(kind, biome, raid)`: wolf cold grey; wolf in las Tierras = ash beast (ash grey, faint ember emissive); brute purple-brown 1.8; elite (reforzado) near-black with purple emissive 2.4; elite2 (escudado) sea-blue-grey + its board; elite3 (turba) peat olive + mantle; elite4 (roca) stone grey + slab. One `MeshStandardMaterial` clone of the fox material per look key, cached (≤ 8 materials in the game). The fox texture stays (colour multiplies it). Scales and the boards/mantle/slab stay exactly as today.
- **[D] Charge marker:** while any dungeon view says `elite.charging` (forest, coast, swamp, mountain), a red ring (the Zancudo pattern: `RingGeometry`, `depthTest: false`, pulsing) under that dungeon's elite (`elite`, `elite2`, `elite3`, `elite4`) plus a short arrow toward its yaw. Only visual; timings unchanged.
- **[D] Poses** (`poses.ts`, applied after `mixer.update` by multiplying bone quaternions; the root tilt goes on the model group): roll = `Jump` held mid-air + model group spins 360° in X over 0.45 s, knees and arms tucked; block = `Idle` + arms crossed in front, torso 10° forward; bow = `Idle` + left arm straight ahead, right hand back by the face (opens for 0.15 s at release = when the anim restarts); climb = `Walking` slow + torso 25° toward the wall, arms alternating up by the step phase; glide = `Jump` held + arms out, legs back together, cloth = a 2×4 plane with the wind sway (not a cone); slide = `Jump` held + body lying (−80° X), arms forward. Parameters in a table, one PNG per pose from the harness.
- **[D] Paper light:** the paper material stays `MeshBasicMaterial` (drawings must keep their colours) but its colour is multiplied by `paperLight` = mix(hemisphere, sun colour) from the look, floored at 0.55 by day and 0.35 at night so drawings never go black (§2.4 read the game first); the existing per-actor tints still multiply on top. **Paper border** (medium/high): 8 alpha taps at 2 texels; transparent pixels next to opaque ones become off-white paper. Low: no border (8 taps per pixel of a big card).
- **[D] Moonlit rim:** `patchRim` adds `rimCol * pow(1 − N·V, 3) * rimK` to actor materials (robot, fox looks, creatures): `rimK` = 0.55 × night (0 at noon), `rimCol` = the look's moon colour brightened. Applies on every tier (≈ 4 ALU on actor pixels only). Spec §4 also names the Corazón and the walls; they are world Lambert materials and a rim there would cost on every world pixel, so they keep the glow points only (actors only; to review).
- **[D] Drop-ins** (`drop-ins.ts`): `DROP_INS = { deer, fish, frog, whale, wolf, brute }` with target height and clip names (Idle/Walk/Gallop…). `loadOptional(name)` does a `HEAD`/`GET` of `/models/<name>.glb` and uses it only when the response is ok and not `text/html` (Vite/Workers SPA fallbacks answer 200 with HTML); any error → `null` → procedural/fox. The creature classes take an optional `ModelKit`: when present they draw a skinned clone with its mixer (Idle/Walk/Gallop by speed) instead of the procedural mesh. `player.glb`, birds, nature and textures stay out (spec §9: plan aparte / alta only).
- **[D] Harness `--vitrina`:** a client-only showcase in the perf hook (`showcase(what)`): at a fixed forest spot at noon and at midnight, it places the four creatures (tame and wild), one fox per enemy look, a charging marker, a paper drawing and the player in each pose, and shoots PNGs. Nothing of it is sent to the server.

## File Structure

- Create `src/client/scene/creature-rig.ts` (+test), `src/client/actors/poses.ts` (+test), `src/client/actors/enemy-look.ts` (+test), `src/client/actors/drop-ins.ts` (+test).
- Modify `src/client/scene/patches.ts` (+test), `steeds.ts`, `fish.ts`, `frog.ts`, `whale.ts`, `src/client/actors/actor.ts`, `paper.ts`, `models.ts`, `src/client/game.ts`, `src/client/perf-hook.ts`, `scripts/perf/run.mjs`, `scripts/perf/baseline.json`, `public/models/CREDITS.md` (drop-in note).

## Tasks

### Task 1: pure — creature rigs, poses, enemy looks, drop-ins

```ts
// creature-rig.ts
export type CreatureKind = 'deer' | 'fish' | 'frog' | 'whale';
export const PART = { body: 0, legFL: 1, legFR: 2, legBL: 3, legBR: 4, tail: 5, head: 6, fin: 7 } as const;
export interface RigGeometry { position: Float32Array; color: Float32Array; part: Float32Array; pivots: [number, number, number][] }
export function buildCreature(kind: CreatureKind): RigGeometry;        // non-indexed triangles
export interface RigPose { rot: [number, number, number][]; wave: [number, number, number]; lift: number }
export function deerPose(phase: number, speed: number, bucking: boolean, now: number, seed: number): RigPose;
export function fishPose(phase: number, speed: number, bucking: boolean, now: number): RigPose;
export function frogPose(moving: boolean, wild: boolean, bucking: boolean, now: number): RigPose & { throat: number };
export function whalePose(now: number): RigPose;
export function rigPoint(p: [number, number, number], part: number, pivots, pose: RigPose): [number, number, number]; // CPU mirror of the shader
// poses.ts
export type PoseAnim = 'roll' | 'block' | 'bow' | 'climb' | 'glide' | 'slide';
export interface BonePose { bones: Record<string, [number, number, number]>; rootX: number; rootY: number }
export function poseFor(anim: string, t: number): BonePose | null;     // t = seconds since the anim started
// enemy-look.ts
export interface EnemyLook { key: string; color: number; emissive: number; scale: number }
export function enemyLook(kind: EnemyKind, biome: Biome, raid: boolean): EnemyLook | null; // null = paper / not a fox
export function chargingKinds(d: DungeonViews): EnemyKind[];
// drop-ins.ts
export const DROP_INS: Record<'deer' | 'fish' | 'frog' | 'whale' | 'wolf' | 'brute', { height: number; clips: { idle: string; walk: string; run: string } }>;
export function isModelResponse(ok: boolean, contentType: string | null): boolean;
```

- [ ] **Step 1: failing tests.** Rigs: each kind within its triangle cap; every vertex has a part 0..7 with a pivot; deterministic; bounding sizes close to today's boxes (deer ~2.2 m tall with antlers, fish ~3 m long, frog ~1.8 m, whale ~9 m). Poses: deer front-left and back-right legs swing together and opposite to the other pair; still = legs 0 and head down (grazing); bucking tilts the body; fish wave phase advances with speed; frog legs extended only while moving, throat only when wild; `rigPoint` of a leg tip moves forward when its leg rotates forward; body part untouched by leg rotations. Poses: roll spins the root 2π over 0.45 s and 0 after; block arms crossed (upper arms rotated toward each other) and torso forward 10°; climb arms alternate with time; slide root −80°; unknown anim → null. Looks: every fox kind has a look, paper kinds → null; distinct colours per kind; wolf in `tierras` = ash; scales = today's (1, 1.3 raid, 1.8, 2.4). `chargingKinds` maps each dungeon's `charging` to its elite kind. Drop-ins: HTML fallback rejected, `model/gltf-binary` and `application/octet-stream` accepted, not-ok rejected.
- [ ] **Step 2: implement.** **Step 3:** green, commit `feat(visuales): criaturas low-poly, poses, looks de enemigo y tabla de modelos (puro)`.

### Task 2: the four creatures on the GPU rig

- [ ] **Step 1:** `patches.ts` `patchRig(mat)` (+test: key, `part` attribute and uniforms in the chunk); `creatureMesh(kind, shadows)` → `THREE.Mesh` with the merged geometry and its own material clone, `setRig(mesh, pose)`. Rewrite `SteedMeshes`, `FishMeshes`, `FrogMeshes`, `WhaleMesh` internals (same public API, halos and spout as today).
- [ ] **Step 2:** perf hook `showcase(what)` and harness `--vitrina` (client-only scene, day/night PNGs). Green; shots of each mount. Commit `feat(visuales): ciervo, pez, rana y ballena low-poly con huesos en el shader`.

### Task 3: enemy colours, the charge marker and the robot's poses

- [ ] **Step 1:** `Actor.setSkin(look)` (cached material per look key; `userData.main` kept so tints still work); `game.ts` calls it per enemy with the biome at its position; `ChargeMarks` (ring + arrow, one shared material) from `chargingKinds`. `Actor.update` applies `poseFor(currentName, t)` after the mixer; `PLAYER_CLIPS` bases per the table; glider = 2×4 plane with `patchSway`.
- [ ] **Step 2:** green; `--vitrina` shots of the six enemy looks, the marker and each pose. Commit `feat(visuales): color por tipo de enemigo, marca de carga y poses del robot`.

### Task 4: light on the paper, moonlit rim, drop-in loader

- [ ] **Step 1:** `patchPaper(mat, { border })` and `PAPER_UNIFORMS.paperLight` set per frame from the look; `patchRim(mat)` + `RIM_UNIFORMS` set per frame (night factor, moon colour) on the robot, fox looks and creatures. `models.ts` `loadOptional` + `loadDropIns()`; creature classes and the enemy factory accept the kits (fallback when null). `CREDITS.md` note.
- [ ] **Step 2:** green; `--vitrina` night shots (robot on the coast at night, papers day/night). Commit `feat(visuales): luz en el papel, borde de luna y modelos "suelta y listo"`.

### Task 5: Ship

- [ ] Full harness `npm run perf` (3 tiers, one pass); `--update` with the new cost; HANDOFF: "Visuales — resumen" at the top of the Visuales area (V2-A..E, decisions to review, final perf table, what Gabriel checks on phones with `?fps=1`, pointer to the drop-in list), "## Visuales · V2-E — …" section, and the top "Aventura completa — estado" paragraph (#2 done; next #7 Pulido with the tutorial); push; one short comment on PR #3.
