# Aventura — Slice 4 · S4-C: santuarios de la Montaña, cuarzo, arma 4–5 y refugios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three mountain shrines (ids 9–11 after the swamp's 6–8). **Cornisa** (the tallest pared): the orb sits on the pared's top edge (~its height up the face); route A climbs the terrain face (dry rock only, S4-B rule) with **2 bare resting ledges** on the way; route B = **3 frog jumps** up bare ledges (+7, +14, +21 over the foot). No gate (like the forest's Roca Lisa): the climb is the puzzle; in rain only the frog route works. **Losas gemelas** (a gentle Faldas spot): two plates 14 m apart; both pressed at once opens the gate **20 s**. Holders: a player, or a **loose boulder** a few metres uphill of plate 2 that a **Viento gust rolls onto plate 2** (it stays there 60 s, then rolls back). Piedra pillar = `// S4-E`. **Bloques** (the gentle spot nearest the Cumbre's centre): a 6 × 6 grid (2 m cells), 3 stone blocks, 3 marked cells, a reset lever; the gate opens while all 3 cells are filled. Only Empujar moves blocks (S4-E): A on a block says "No se mueve" — a "vuelve luego" shrine, visible now. The pure push rule and a fixed 8-move solution ship now (tested). **10 quartz veins** on the paredes' faces, 8–20 m over each face's foot: A within reach → **2 cuarzo**, back after 2 in-game days, per player. Mountain orbs give **1 cuarzo**. **Weapon levels 4–5** at the Heart: 3 cuarzo + 10 piedra + 5 madera each (+15 % each, max +75 %). **2 refugios** join the fogatas list as ids 4–5 (Faldas, and high on the Cumbre): lit by Llamarada or torch, travel to/from the Heart by day, and lit fogatas warm like a campfire.

**Architecture:** New `src/shared/mountain-shrines.ts` holds `MOUNTAIN_SHRINE`, `generateMountainShrines`, `QUARTZ` + `generateQuartzVeins`, `generateRefugios`, and the Bloques rules (`BLOCKS`, `pushBlock`, `blocksSolved`). All seeded from `mountainFeatures(seed)` + terrain, so client and server agree without traffic. Shrines append to the same `Shrine[]` list (new kinds `'cornice' | 'twins' | 'blocks'`), so beams, orbs, stamina and "one orb per player" are reused. Cornisa ledges are bare `Crag`s added to `climbables()` and the client climb list. `generateFogatas` appends the 2 refugios (`FOGATA.count` 4 → 6, `Fogata.refugio?: true`), so lighting, the Menú trips and the `travel` validation follow. Items: `ItemId` + `'quartz'`; `UPGRADE` gains `max: 5` and `upgradeCost(lvl)` (pearls for 0–2, quartz for 3–4). Live-only: Losas boulder position and home time, Bloques block cells. Saved (optional, old saves load): `SavedPlayer.quartz?: Record<number, number>` (vein id → sim time).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §5.1, §5.2, §5.3, §9.2, §15.3 (row S4-C).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.quartz`, `NAMES.refugio`, `NAMES.heart`, `NAMES.powerStone`, `NAMES.powerWind`, `NAMES.frog`).
- **Phones first. Touch grid stays at 10 pills.** Everything new is the contextual **A** (keyboard E): take quartz, push a block (refused for now), pull the reset lever, buy weapon levels 4–5, light/travel at a refugio. Plates need no button.
- **Trust boundary:** every client message through `decodeClient`; the server checks vein reach and height, per-player regrow, costs and the level cap, plate occupancy, lever reach.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 33 → 34 (shrine part ≤ 7, `ShrineView.blocks`, `travel.to` < 6); Task 3 bumps 34 → 35 (`quartz` message, `SelfState.quartz`, weapon 0–5). New saved fields optional only.
- **Piedra does not exist yet (S4-E).** Built and visible now: the Bloques grid, blocks, cells and lever ("No se mueve"; the lever resets); the Losas plates (a pillar weighing a plate). The Empujar path and "pillar on plate" are `// S4-E` markers.
- **Mountain corruption does not exist yet (S4-D).** A mountain orb cleanses nothing (and must not cleanse a swamp zone, which the current `id >= 6` rule would do): `// S4-D` marker.
- **[D] Cornisa has no gate** (like Roca Lisa): the climb is the challenge; the orb's height check (`p.y ≥ orb.y − 2.5`) is the lock.
- **[D] The boulder rolls onto plate 2 on any gust that hits it** (a groove leads there), instead of a free 6 m slide that would need exact aim. It rolls back after 60 s so the puzzle is there for the next player.
- **[D] "While climbing" for quartz = reach in 3D** (≤ 2 m horizontal, ≥ vein.y − 1.5): a vein 8+ m up a steep face is only reached by climbing or the frog; the server does not know the climb state.
- **[D] All lit fogatas warm** (swamp ones too): one rule, no harm.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Mountain shrines, quartz veins, refugios, quartz item and weapon 4–5 (shared)

**Files:** Create `src/shared/mountain-shrines.ts`, `src/shared/mountain-shrines.test.ts`; Modify `src/shared/shrines.ts` (kinds + labels), `src/shared/items.ts` (`quartz`, `UPGRADE.max 5`, `upgradeCost`), `src/shared/fogatas.ts` (refugios appended, count 6); Tests `items.test.ts`, `fogatas.test.ts`.

**Interfaces:**
```ts
export type ShrineKind = ... | 'cornice' | 'twins' | 'blocks';
// Shrine.parts: cornice = [] (pillar null; ledges separate); twins = [plate1, plate2, boulder home]; blocks = [block×3, cell×3, lever]
export const MOUNTAIN_SHRINE = { firstId: 9, ledgeR: 1.4, ledgeRise: 7, ledgeId: 1300, plateGap: 14, twinsOpen: 20, boulderBack: 60, boulderUp: 5, lever: 7 } as const;
export function generateMountainShrines(t: Terrain, seed: number): Shrine[]; // ids 9,10,11
export function corniceLedges(t: Terrain, seed: number): Crag[]; // 3 bare discs up the Cornisa's face
export const BLOCKS = { cell: 2, n: 6, starts: [[1,1],[3,1],[1,3]], cells: [[4,4],[2,4],[4,2]] } as const; // handmade
export function blockCell(s: Shrine, c: readonly [number, number]): { x: number; z: number };
export function pushBlock(blocks: readonly (readonly [number, number])[], i: number, dir: readonly [number, number]): [number, number][] | null; // one cell; in-grid, free
export function blocksSolved(blocks: readonly (readonly [number, number])[]): boolean;
export const BLOCKS_SOLUTION: readonly { i: number; dir: readonly [number, number] }[]; // 8 pushes
export const QUARTZ = { veins: 10, reach: 2, below: 1.5, yield: 2, regrowDays: 2, orb: 1, minUp: 8, maxUp: 20 } as const;
export interface QuartzVein { id: number; x: number; y: number; z: number }
export function generateQuartzVeins(t: Terrain, seed: number): QuartzVein[];
export function generateRefugios(t: Terrain, seed: number): { x: number; z: number; y: number }[]; // [Faldas, Cumbre]
// items.ts
export type ItemId = ... | 'quartz';
export const UPGRADE = { cost: {pearl:3,stone:10,wood:5}, costHigh: {quartz:3,stone:10,wood:5}, pearlMax: 3, step: 0.15, max: 5 } as const;
export function upgradeCost(lvl: number): Inventory; // lvl < 3 → cost, else costHigh
// fogatas.ts: FOGATA.count 6; Fogata.refugio?: boolean; generateFogatas = 4 swamp + 2 refugios (ids 4, 5)
```
- [ ] **Step 1: failing tests.** For 4 seeds: 3 mountain shrines, ids 9/10/11, kinds cornice/twins/blocks, same for the same seed, all `inMountains`, none on smooth rock. Cornice: orb on the tallest pared's top edge (orb.y − foot ≥ 12); 3 ledges bare, tops rising by 7 (±0.5) from the foot, each over lower ground than its top, consecutive ≤ 6 m apart horizontally. Twins: plates 14 m apart, both on slope < 20°, boulder home within 6 m of plate 2 and ≥ 2 m higher ground... (≥ 0 m: "uphill" best-effort). Blocks: grid cells all in the mountains with slope < 25°; lever beside the grid. `pushBlock` refuses out-of-grid and into another block; the 8-move solution solves the start; the start is not solved. 10 quartz veins, 8–20 m above the foot of their pared, on a face cell (slope > 45°), distinct, ≥ 4 m apart. 2 refugios in the mountains on slope < 20°, one with depth 40–120 and one > 120. Fogatas: 6, ids 4–5 are the refugios (`refugio: true`), swamp ones unchanged. Items: `ITEM_LABELS.quartz` from `NAMES.quartz`; `weaponMult(5) = 1.75`, `(9) = 1.75`; `upgradeCost(2).pearl = 3`, `upgradeCost(3).quartz = 3`.
- [ ] **Step 2: implement** (`createRng(seed ^ 0x6d7c)`; spots found by bounded ring searches with fallbacks; test updated: fogatas count 4 → 6, intentional).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios de la Montaña, cuarzo y refugios (reglas)`.

### Task 2: Mountain shrines and refugios on the server (protocol v34)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `decodeClient` accepts shrine part 7, rejects 8; `travel` to 5 accepted, 6 rejected. `sim.shrines` has 12 (old "9 shrines" updated: intentional). **Cornisa:** the orb from the ground → nothing; standing on the top edge → cleared, +1 cuarzo, no zone cleansed. `climbables()` includes the 3 ledges. **Losas:** a player on plate 1 alone → closed; players on both → open (20 s after they leave); a Viento gust at the boulder → it sits on plate 2 (`ShrineView.block`), a player on plate 1 then opens it; 60 s later the boulder is home. **Bloques:** A on a block → "No se mueve"; lever (part 7) → "Los bloques vuelven a su sitio"; view has `blocks` (3 positions); orb → "Una verja de luz lo protege". **Refugios:** a Llamarada at refugio 4 lights it; travel from the Heart to 5 by day lands 2 m east; near a lit refugio high up warmth does not drop.
- [ ] **Step 2: implement** (`shrineLive` gains `blocks` (cells) and `boulderAt`; `stepShrines` handles `twins`; `gustThings` rolls the boulder; `// S4-E` markers for Empujar and pillars on plates; `// S4-D` marker for mountain cleansing; `nearFire` includes lit fogatas).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios de la Montaña y refugios en el servidor (protocolo v34)`.

### Task 3: Quartz and weapon levels 4–5 on the server (protocol v35)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// ClientMsg: { t: 'quartz'; id: number }
// SelfState: quartz: number[] (vein ids still regrowing for you); weapon 0–5
// SavedPlayer: quartz?: Record<number, number>
```
- [ ] **Step 1: failing tests.** Decode `quartz` (integer id < 10). A player at a vein (y ≥ vein.y − 1.5, ≤ 2 m) gets 2 cuarzo ("Cuarzo: 2"), again → "Aún no ha vuelto a brillar"; after 2 × DAY_LENGTH it works again; from the foot of the face → nothing; another player harvests their own. Upgrade: levels 1–3 with pearls as before; at 3 with 3 cuarzo + 10 piedra + 5 madera → 4 ("+60 % de daño"), again → 5; at 5 → "El arma ya no da más de sí"; at 3 without cuarzo → "Faltan materiales" (old test at level 3 updated: intentional). Old saves without `quartz` load.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): vetas de cuarzo y arma de nivel 4 y 5 (protocolo v35)`.

### Task 4: Client — mountain shrines, quartz, upgrade, refugios

**Files:** Create `src/client/mountain-ui.ts` + `mountain-ui.test.ts`, `src/client/scene/quartz.ts`; Modify `src/client/coast-ui.ts` (`shrinePartAt`: blocks/lever; upgrade label by level), `src/client/scene/shrines.ts` (plates, boulder, grid + blocks + cells + lever), `src/client/scene/fogatas.ts` (refugio: hut walls around the ring), `src/client/hud.ts` (Menú: "Ir al refugio N"), `src/client/game.ts` (shrine list concat, ledges in the climb list, quartz in `act` + prompt).

- [ ] **Step 1: failing tests.** `quartzAction`: at a ripe vein at height → `{quartz id, 'Picar cuarzo'}`; regrowing / below → null. `coastAction` upgrade: level 3 with 3 cuarzo → label "Mejorar el arma (3 cuarzo, 10 piedra, 5 madera)"; level 5 → null. `shrinePartAt`: block → "Empujar el bloque" (part 1–3), lever → "Tirar de la palanca" (part 7).
- [ ] **Step 2: implement.** Quartz: one instanced white emissive crystal cluster per vein (`fog: false`, visible from far), hidden while regrowing for you. Plates: flat discs; boulder: grey dodecahedron at `view.block`. Bloques: 3 boxes at `view.blocks`, 3 pale squares for cells, lever post. Cornisa ledges via `buildCrags`. Refugio: 3 low stone walls around the ring.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de santuarios de la Montaña, cuarzo y refugios`.

### Task 5: Ship

- [ ] Full suite green, `git push origin aventura/resto`, append the S4-C section to `docs/superpowers/HANDOFF-aventura.md`, commit + push, one short comment on PR #3.
