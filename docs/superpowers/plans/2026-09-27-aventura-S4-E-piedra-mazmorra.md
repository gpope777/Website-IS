# Aventura — Slice 4 · S4-E: mazmorra de la Montaña y la Piedra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The fourth dungeon and the fourth power. The **cave mouth** opens 5 m north of the Raíz-madre de la Montaña (zone 14, x −70, 140 m north of the forest rim; S4-D left the root there for this); A at it enters an interior at **`x = HALF + 600`** (24 × 190 m, cold blue light). Inside: **levers** → **altar: Piedra** → **high plate** (a plate on a 3 m shelf; weighted = gate open; a pillar holds it, or a friend who climbed the shelf) → **block room** (push 2 blocks onto 2 slots of a 5 × 5 grid, 5 pushes, reset lever) → **rockfall corridor** (40 m, no gate: boulders roll down 3 lanes every 2 s, 15 damage + 3 m knockback; a pillar in a lane stops them) → **bruto de roca** (500 PV; from the front hits do 10 %; its charge into a pillar or the arena wall stuns it 5 s with its back exposed; a parry exposes it 3 s) → the boss room, **empty and ready for S4-F**. **Piedra** (H / power pill): **Alzar** a stone pillar 2 × 2 × 3 m, 4 m ahead toward the aim, snapped to a 2 m grid, cooldown 3 s, **max 3 per player** (a 4th removes your oldest), each lasts **120 s** or until broken (**80 PV**). Pillars are steps (climbable crags), weights (any plate), barricades (raiders attack them like walls; El Triángulo's rocks target them). A pillar raised under a beast throws it (stun 1 s, −4). A **charging** elite that hits a pillar is **stunned 5 s**. **Empujar** is the contextual A beside a stone block (Bloques shrine, dungeon block room): one 2 m cell away from you; without Piedra "No se mueve". **Switching** cycles 🌿 → 🌬️ → 🔥 → 🪨. **Torre:** a fourth trap in the Menú ("Trampa: estacas / red de raíces / hoguera / torre"), key **I**, needs Piedra; 6 stone + 2 cuarzo, 150 PV, a 4 m tower you can climb and stand on (arrows +50 % range from its top), and it knocks a raider within 3 m of its base back 3 m every 4 s.

**Also resolves the `// S4-E` markers:** Bloques' Empujar with Piedra (a solved grid opens the gate); a pillar weighs any plate (forest dungeon losa, the forest Losa shrine, Marea's plate, Losas gemelas' two plates, the new high plate); a pillar raised ≤ 2 m from a 15–17 root crushes it ("La roca aplasta la raíz marchita. La montaña respira"; never 14: that's El Cucurucho, S4-F); `rockTarget` targets pillars (they are structures).

**Architecture:** Pure rules in two new shared modules: `src/shared/piedra.ts` (`PIEDRA`, `TOWER`, `pillarSpot`, `pushDir`, `structureCrags`) and `src/shared/mountain-dungeon.ts` (`MOUNTAIN_DUNGEON` layout, `inMountainDungeon`, `insideMountain`, `clampMountainDungeon`, `shelfCrag`, `rockfallLane`, `boulders`, `inRockfall`, `inRockRoom`, `inMountainBossRoom`, `mountainEntrance`, `DBLOCKS` + `dungeonBlockCell`). `pushBlock` gains an `n` (grid size) parameter so both grids share it. `dungeon.ts`'s `inAnyDungeon`, `withDungeon` and `clampStep` cover the fourth interior. **Pillars and towers are `Structure`s** (kinds `'pillar'` and `'tower'`): the raid blockers, El Triángulo's `rockTarget`, the `hit`/`wrecked` messages and the client's structure list all work for them unchanged; pillars are never saved and expire from a live-only map. The bruto de roca reuses `stepElite` (`createRockBrute()` with its own room box; wall-hit stun inside `stepElite` for `elite4`).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-4-montanas-design.md` §4 (Piedra, Empujar, torre, switching), §5.1 (Losas gemelas / Bloques with Piedra), §6 (cleansing with a pillar), §7 (rocks at pillars), §11.1–11.2 (dungeon), §15.1, §15.3, §16 (row S4-E).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`mountainRoot`, `powerStone`, `eliteMountain`, `tower`).
- **Phones first. Touch grid stays at 10 pills.** Enter/leave, levers, altar, Empujar and the reset lever are the contextual **A**; Alzar is the power pill (tap), switching is the 0.5 s hold; the torre goes through the existing trap pill (Menú selector).
- **Trust boundary:** every client message through `decodeClient`. The server checks owning Piedra, its own cooldown, reach/grid of the pillar spot, the per-player cap, that pushes come from beside the block, gates, and that a torre needs Piedra. `'pillar'` is never a `place` kind.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 38 → 39 once for the whole plan: `power.kind` `'piedra'`; `StructureKind` `'pillar' | 'tower'` (only `'tower'` placeable); `dungeon` acts 18–25; `DungeonView.mountain`; `SelfState.piedra` / `stoneLeft`; `EnemyKind` `'elite4'`. New saved field `SavedPlayer.piedra?` only: old saves load. Pillars are dropped from `save()`.
- **[D] Pillars are structures** (not a new `snap.pillars`): same messages, same raid code, same rock target. Their crag ids are `920_000 + structure id` (the spec's range) through `structureCrags`.
- **[D] Four physical gates** (levers, high plate, blocks, bruto de roca) plus the rockfall corridor without a gate (like the chasm and the boardwalk).
- **[D] High plate:** a climbable 3 m shelf (a crag) with the plate on top. Weighted = a live player standing on the shelf top at the plate, or a pillar whose centre is ≤ 2 m from the plate (the pillar rises beside/through the shelf). The gate is open only while weighted (no jam): solo = Piedra, co-op = a friend up there.
- **[D] Block room:** 5 × 5 grid of 2 m cells centred at z 74, blocks start `[1,1]`, `[3,1]`, slots `[1,3]`, `[4,3]`; solution `0:+z, 0:+z, 1:+x, 1:+z, 1:+z` (5 pushes). Solved = gate 2 open for good (until the room resets). Reset lever (act 25) puts them back.
- **[D] Rockfall:** pure function of time: lane `L` (x −8 / 0 / +8, half width 4) spawns a boulder every 2 s (offset `L · 2/3` s) at z 130 rolling to z 90 at 8 m/s. A pillar in a lane removes every boulder of that lane downstream of it (z below the pillar). A boulder within 1.2 m (z) of a player on the floor (y < floor + 1.5) → 15 damage (Capa counts, a roll dodges, a guard blocks) and 3 m knockback toward the entrance; 1 s per-player grace. Pillars take no damage from boulders.
- **[D] Charge stun:** any elite (bruto reforzado, escudado, de turba, de roca) whose charge passes within 2 m of a live pillar is stunned 5 s and exposed 5 s ("…se estrella contra el pilar"). The pillar is not hurt. Only the bruto de roca is stunned by the arena wall.
- **[D] Torre knockback** only hits raiders (the night's wild wolves are not raiders). Arrow range ×1.5 when the shooter stands on a tower's top (≤ 1.4 m from its centre, y ≥ top − 0.6).
- **[D] Cave mouth:** a doorway at zone 14's root + 5 m north (the root keeps its centre, like the swamp trunk). A within 9 m. Leaving puts you 6 m south of it (forest side).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — Piedra and the mountain interior (shared)

**Files:** Create `src/shared/piedra.ts`, `src/shared/piedra.test.ts`, `src/shared/mountain-dungeon.ts`, `src/shared/mountain-dungeon.test.ts`; Modify `src/shared/dungeon.ts` (+ test), `src/shared/mountain-shrines.ts` (`pushBlock(…, n)`).

**Interfaces:**
```ts
export const PIEDRA = { ahead: 4, grid: 2, half: 1, height: 3, cooldown: 3, max: 3, life: 120, hp: 80, reach: 8, liftR: 1.5, liftStun: 1, liftDamage: 4, chargeStun: 5, chargeR: 2, rootReach: 2, plateR: 2, cragId: 920_000 } as const;
export const TOWER = { height: 4, r: 1.2, rangeMult: 1.5, knockR: 3, knock: 3, every: 4 } as const;
export function pillarSpot(px, pz, ax, az): { x: number; z: number };      // 4 m toward the aim, snapped to the 2 m grid
export function pushDir(px, pz, bx, bz): readonly [number, number];         // away from you, dominant axis
export function structureCrags(ss: readonly Structure[]): Crag[];            // pillars (r 1, 3 m) and towers (r 1.2, 4 m), ids 920_000 + id

export const MOUNTAIN_DUNGEON = { x: HALF + 600, z0: 0, z1: 190, halfW: 12, floor: 30, pad: 10, entryZ: 5, exitReach: 2.5,
  gatesZ: [32, 60, 88, 160], levers: [{ x: -9, z: 22 }, { x: 9, z: 22 }], leverReach: 2.5, leverWindow: 6, altarZ: 44, altarReach: 2.5,
  shelf: { x: 8, z: 54, r: 2.5, h: 3 }, plateR: 1.5,
  blocks: { z: 74, n: 5, cell: 2, starts: [[1, 1], [3, 1]], slots: [[1, 3], [4, 3]] }, resetLever: { x: -10, z: 66 }, pushReach: 2.5,
  rockfall: [90, 130], lanes: [-8, 0, 8], laneHalf: 4, every: 2, roll: 8, hitZ: 1.2, damage: 15, knock: 3, grace: 1,
  eliteRoomZ: 132, eliteZ: 146, bossRoomZ: 160, mouthR: 4, enterReach: 5, shelfId: 1400 } as const;
export function inMountainDungeon(x, z, pad = 0): boolean;
export function insideMountain(p): { x; z };
export function clampMountainDungeon(px, pz, nx, nz, gates): { x; z };
export function shelfCrag(): Crag;                                   // climbable, top = floor + 3
export function inRockfall(x, z): boolean; export function rockfallLane(x): number;  // −1 off lanes
export function boulders(t: number, lane: number, blockers: readonly { x: number; z: number }[]): number[];  // z of each live boulder
export function inRockRoom(x, z): boolean; export function inMountainBossRoom(x, z): boolean;
export function dungeonBlockCell(c: Cell): { x; z };
export function mountainEntrance(): { x: number; z: number };        // zone 14's root, 5 m north
```
- [ ] **Step 1: failing tests.** `pillarSpot` from (0,0) aiming +x lands at (4, 0); an off-grid aim snaps to even metres. `pushDir` from the block's −z side is `[0, 1]`. `structureCrags` returns a 3 m disc for a pillar and a 4 m one for a tower, ids 920_000+. `pushBlock(…, 5)` refuses cell 5. The dungeon block solution solves `DBLOCKS` in 5 pushes. `boulders` gives a boulder at z 130 right at a lane's spawn and at z 122 one second later; a pillar at z 110 in that lane removes boulders below 110; a pillar in another lane changes nothing. `clampMountainDungeon` blocks a shut gate, passes an open one, clamps the walls. `withDungeon(t).heightAt` inside is the floor; `clampStep` delegates; `inAnyDungeon` is true inside. `mountainEntrance` is 5 m north of zone 14's root and inside the mountains.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la Piedra y de la mazmorra de la Montaña`.

### Task 2: Piedra on the server — pillars (protocol v39)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/items.ts`, `src/shared/sim/wolves.ts`, `src/shared/sim/world-sim.ts`, `src/shared/sim/lieutenant.ts`, `src/client/*` (only what the new types force); Tests `protocol.test.ts`, `world-sim.test.ts`, `lieutenant.test.ts`.

**Interfaces:**
```ts
// POWER_KINDS + 'piedra'; StructureKind + 'pillar' | 'tower' (STRUCTURE_KINDS gains only 'tower'); BUILD_COST.pillar = {} (never placed), tower = { stone: 6, quartz: 2 }; HP pillar 80, tower 150
// EnemyKind + 'elite4'; SelfState.piedra: boolean, stoneLeft: number; SavedPlayer.piedra?: boolean
// dungeon acts: 18 enter the cave, 19 leave, 20/21 levers, 22 take Piedra at the altar, 23/24 push dungeon block 0/1, 25 the reset lever
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts `power.kind 'piedra'`, `place 'tower'`, dungeon act 25 (not 26), and refuses `place 'pillar'`. Without Piedra → "Aún no tienes ese poder"; with it a pillar appears 4 m ahead (a `built` of kind `pillar`, 80 PV); a second cast within 3 s is refused; a 4th pillar removes the oldest; after 120 s it is gone (`wrecked`); the pillar is not in `save()`. A wolf on the spot is stunned and loses 4. The pillar is climbable (`climbables()` has its crag). A raider walking at the Heart past a pillar attacks it (raid blockers). `rockTarget` picks a pillar. A pillar ≤ 2 m from zone 15's root cleanses it; zone 14 never. Protocol v39. Old save loads without `piedra`.
- [ ] **Step 2: implement** (`onStone`, `l.stoneReadyAt`, `pillarUntil` map, `stepPillars`, raid blockers include pillars, `save()` filters them, `climbables()` includes `structureCrags`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la Piedra alza pilares (protocolo v39)`.

### Task 3: Mountain dungeon on the server — enter, levers, altar, high plate, blocks, rockfall

**Files:** Modify `src/shared/protocol.ts` (`MountainDungeonView`), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

**Interfaces:**
```ts
export interface MountainDungeonView { gates: boolean[]; levers: boolean[]; plate: boolean; blocks: { x: number; z: number }[]; elite: { hp: number; max: number; charging: boolean; exposed: boolean } | null }
// DungeonView.mountain
```
- [ ] **Step 1: failing tests.** Act 18 far from the mouth does nothing; near it → inside. Act 19 at the exit → 6 m south of the mouth. Both levers within 6 s → gate 0. Act 22 after gate 0 → `piedra` saved. Walking into shut gate 1 → `fix`. A pillar raised at the plate opens gate 1 and it shuts when the pillar goes; a player on the shelf top opens it too. Act 23/24 without Piedra → "No se mueve"; with Piedra from the right side the block moves one cell; the 5-push solution opens gate 2; act 25 resets. In the rockfall corridor a player standing in lane 0 is hit (−15, pushed 3 m back) within 2 s; behind a pillar in that lane they are not. Warm inside.
- [ ] **Step 2: implement** (`mountainLive`, `mountainGates()`, `onMountainDungeon` acts 18–25, `stepMountainDungeon` for the plate and the rockfall, move validation through `clampStep(…, mountainGates)`, `climbables()` includes the shelf, snapshot view).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): mazmorra de la Montaña en el servidor`.

### Task 4: Bruto de roca, charge stun, the ready boss room, the torre, and the S4-E markers

**Files:** Modify `src/shared/sim/elite.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.elite4` 500 PV, label), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `createRockBrute()` (id 900_006, unique) stands in its room; its charge into the room wall stuns and exposes it 5 s. From the front a hit does 10 %; exposed, full. A charging elite that meets a pillar is stunned 5 s. A parry exposes it 3 s. At 0 PV gate 3 opens; the room resets when empty; the boss room says "La sala está en calma. Algo con gorro duerme bajo el hielo" once. Torre: without Piedra "Hace falta la Piedra"; with 6 stone + 2 cuarzo it is built; a raider within 3 m is pushed 3 m away, not again within 4 s; a shot from its top reaches 36 m. Markers: Bloques with Piedra moves blocks and the 8-push solution opens the shrine; a pillar on the forest dungeon plate presses it; a pillar on Losas gemelas' plate 2 + a player on plate 1 opens it.
- [ ] **Step 2: implement** (`createRockBrute`, `rockFront`, `stepRockFight`, `pillarStun`, `stepTowers`, `onShoot` range, `onBlocks` push, `pillarOn` in the plates).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): bruto de roca, torre y pilares en losas`.

### Task 5: Client — 4-way switching, pillars, the torre, the mountain interior

**Files:** Modify `src/client/input.ts`, `src/client/trap.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/dungeon-ui.ts`, `src/client/mountain-ui.ts`, `src/client/scene/structures.ts`; Create `src/client/scene/mountain-dungeon.ts`; Tests `input.test.ts`, `trap.test.ts`, `dungeon-ui.test.ts`, `mountain-ui.test.ts`.

- [ ] **Step 1: failing tests.** `nextPower` cycles enredadera → viento → fuego → piedra, skipping unowned; `POWER_ICON.piedra` is 🪨. `KeyI` → `'tower'`. `nextTrap(t, fuego, piedra)` adds torre only with Piedra. `mountainDungeonAction`: near the cave mouth → `{18, 'Entrar en la cueva'}`; exit → 19; levers → 20/21; altar after gate 0 without Piedra → 22; beside a block with Piedra → 23/24 `Empujar`; the reset lever → 25. The Bloques shrine prompt says `Empujar` beside a block. `rockBarText` shows "bruto de roca" and "· expuesto".
- [ ] **Step 2: implement.** The pill icon shows 🪨; H with Piedra raises toward the aim. Pillars and towers in `structures.ts` (grey boxes; the tower with a top); the client climb list adds `structureCrags`. The interior (floor, walls, 4 gates, levers, altar orb in grey, shelf + plate, block grid with 2 slots and a lever, 3 lanes with boulders from `boulders()` on server time, exit ring), the cave mouth (a dark arch) at zone 14, the bruto de roca as the elite with a grey tint and a stone slab. The Menú mentions I and Piedra.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de la Piedra y de la mazmorra de la Montaña`.

### Task 6: Ship

- [ ] Append "## Slice 4 · S4-E — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/resto`, one short comment on PR #3.
