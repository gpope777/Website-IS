# Aventura — Slice 3 · S3-E: mazmorra del Pantano y el Fuego — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The third dungeon and the third power. The **Raíz-madre del Pantano** is a sunken hollow trunk 5 m north of the Laguna Negra's centre (fish, whale or a frog in the air reach it); A on it enters an interior at **`x = HALF + 450`** (24 × 180 m). Inside: **levers** → **altar: Fuego** → **thorn gate** (3 Llamaradas burn it) → **dark gas hall** (3 gas lamps; all three lit within 10 s opens it) → **sinking boardwalk** (10 planks over 30 m of mud; each sinks 1.2 s after someone steps on it and comes back 4 s later; falling in the mud = back at the hall's gate, −10 PV) → **bruto de turba** (480 PV, the elite's charge; standing in one of its room's two mud pools it regrows 10 PV/s unless burning) → the boss room, **empty and ready for S3-F**. **Fuego** (H / power pill): the **Llamarada**, a cone of 6 m × 60°, cooldown 5 s; enemies −6 and **burning** (3 PV/s for 4 s); burning wolves **flee 2 s**; bosses and El Marchito take the damage but never flee. **Switching** cycles 🌿 → 🌬️ → 🔥 (hold the pill 0.5 s / J), skipping powers you lack. **Hoguera:** a third trap in the Menú ("Trampa: estacas / red de raíces / hoguera"), key **U**, needs Fuego; 4 wood + 2 ámbar, 60 PV; the first beast in it burns, every wolf within 4 m flees 2 s, rearms in 8 s.

**Also resolves the `// S3-E` markers:** a Llamarada lights a Candiles brazier without a torch; three Llamaradas burn Turba's peat wall (the shrine opens and stays open while the room lives); a Llamarada within 5 m of a swamp zone's withered root (11–13) cleanses it ("El fuego seca la raíz marchita. El pantano respira"). Zone 10 stays for El Zancudo (S3-F). The shrines client comment in `scene/shrines.ts` becomes the burnt-wall visual.

**Architecture:** Pure rules in two new shared modules: `src/shared/fuego.ts` (`FUEGO`, `HOGUERA`, `inFlame`) and `src/shared/swamp-dungeon.ts` (`SWAMP_DUNGEON` layout, `inSwampDungeon`, `swampFloor`, `clampSwampDungeon`, `plankCrags`, `plankAt`, `inMudPool`, `swampEntrance`, `insideSwamp`). `dungeon.ts`'s `inAnyDungeon`, `withDungeon` and `clampStep` cover the third interior (a third gates array). Live-only state `swampLive` like `coastLive`. The bruto de turba reuses `stepElite` (`createPeat()` with its own room box). Burning and fleeing are two optional timers on `Wolf` (`burn?`, `flee?` + `fleeFrom?`), stepped once per tick for every foe.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §4 (Fuego, hoguera, switching), §6.1 (Candiles/Turba with Fuego), §7 (cleansing by fire), §10.1–10.2 (dungeon), §14.2, §15 (row S3-E).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`swampRoot`, `powerFire`, `eliteSwamp`).
- **Phones first. Touch grid stays at 10 pills.** Enter/leave, levers and the altar are the contextual **A**; the Llamarada is the power pill (tap), switching is the 0.5 s hold; the hoguera goes through the existing trap pill (Menú selector).
- **Trust boundary:** every client message through `decodeClient`. The server checks owning Fuego, its own cooldown, the cone, gates, planks and mud, and that a hoguera needs Fuego.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 28 → 29 once for the whole plan: `dungeon` acts 13–17, `power.kind` `'fuego'`, `DungeonView.swamp`, `SelfState.fuego` / `fireLeft`, `EnemyKind` `'elite3'`, `WolfView.burning?`, `StructureKind` `'fire'`. New saved field `SavedPlayer.fuego?` only: old saves load.
- **[D] Four physical gates** (levers, thorns, gas lamps, bruto de turba) plus the boardwalk as the fifth obstacle without a gate (same call as the coast's chasm): the mud is the obstacle.
- **[D] No root-block plate on the boardwalk.** The spec calls it an optional co-op shortcut; the planks alone are the puzzle.
- **[D] Planks are bare crags** (like the Nenúfares pads): the client stands on them with the existing crag physics; the mud strip's floor is 3 m under the room's floor, and dropping 1 m under the floor there is the fall.
- **[D] Who flees:** kind `'wolf'` only (Llamarada and hoguera alike). Brutes, elites, bosses, the lieutenant and El Marchito burn but hold.
- **[D] Peat wall:** burnt state is live-only (like every shrine puzzle); once burnt it stays open until the room restarts.
- **[D] Entrance:** the trunk is 5 m north of the Laguna's centre (the withered root of zone 10 keeps the centre), in deep water. Reached riding the fish or the whale, or from the frog mid-jump; A within 9 m.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — Fuego and the swamp interior (shared)

**Files:** Create `src/shared/fuego.ts`, `src/shared/fuego.test.ts`, `src/shared/swamp-dungeon.ts`, `src/shared/swamp-dungeon.test.ts`; Modify `src/shared/dungeon.ts` (+ test).

**Interfaces:**
```ts
export const FUEGO = { range: 6, cone: (60 * Math.PI) / 180, cooldown: 5, damage: 6, burnDps: 3, burnFor: 4, flee: 2, rootReach: 5, burns: 3 } as const;
export const HOGUERA = { radius: 1.6, scare: 4, rearm: 8, wear: 10 } as const;
export function inFlame(px, pz, dir, x, z, range = FUEGO.range): boolean;   // within range and ±30°

export const SWAMP_DUNGEON = { x: HALF + 450, z0: 0, z1: 180, halfW: 12, floor: 30, pad: 10, entryZ: 5, exitReach: 2.5,
  gatesZ: [32, 56, 86, 150], levers: [{ x: -9, z: 22 }, { x: 9, z: 22 }], leverReach: 2.5, leverWindow: 6, altarZ: 44, altarReach: 2.5,
  thorn: { x: 0, z: 56 }, lamps: [{ x: -9, z: 64 }, { x: 9, z: 72 }, { x: -9, z: 80 }], lampWindow: 10, darkSight: 6,
  mud: [92, 122], mudDepth: 3, planks: 10, plankHalfW: 1.5, sinkAfter: 1.2, downFor: 4, fallBack: 89, fallDamage: 10,
  eliteRoomZ: 126, eliteZ: 140, pools: [{ x: -6, z: 134 }, { x: 6, z: 144 }], poolR: 3, regen: 10, bossRoomZ: 150, trunkR: 4, enterReach: 5, plankId: 1300 } as const;
export function inSwampDungeon(x, z, pad = 0): boolean;
export function inMud(x, z): boolean;                     // the boardwalk strip
export function swampFloor(x, z): number;                 // floor, minus mudDepth in the mud strip
export function plankAt(x, z): number;                    // plank index under (x, z), or -1
export function plankCrags(up: readonly boolean[]): Crag[]; // planks still up, as bare boxes-as-discs you stand on
export function inMudPool(x, z): boolean;
export function inPeatRoom(x, z): boolean; export function inSwampBossRoom(x, z): boolean;
export function insideSwamp(p): { x; z };
export function clampSwampDungeon(px, pz, nx, nz, gates): { x; z };  // walls, shut gates
export function swampEntrance(): { x: number; z: number };           // LAGUNA centre, 5 m north
// dungeon.ts: inAnyDungeon includes it; withDungeon returns swampFloor inside its pad; clampStep(…, swampGates = []) delegates.
```
- [ ] **Step 1: failing tests.** `inFlame`: ahead at 5 m yes, 7 m no, 35° off no, behind no. `swampFloor` = 30 in rooms, 27 in the mud. `plankAt` finds plank 0 at the strip's start and −1 off the centre line. `plankCrags` returns only the up planks, tops at the floor. `inMudPool` true at pool 0. `clampSwampDungeon` blocks a shut gate, passes an open one, clamps the walls. `withDungeon(t).heightAt` inside the swamp pad is `swampFloor`; `clampStep` delegates; `inAnyDungeon` is true inside. `swampEntrance` lies in the Laguna (deep water).
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas del Fuego y de la mazmorra del Pantano`.

### Task 2: Swamp dungeon on the server — enter, levers, altar, boardwalk (protocol v29)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/items.ts`, `src/shared/sim/wolves.ts`, `src/shared/sim/world-sim.ts`, `src/client/*` (only what the new types force); Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
export interface SwampDungeonView { gates: boolean[]; levers: boolean[]; thorn: number; lamps: boolean[]; planks: boolean[]; elite: { hp: number; max: number; charging: boolean; burning: boolean } | null }
// DungeonView.swamp; SelfState.fuego: boolean; SelfState.fireLeft: number; WolfView.burning?: true
// POWER_KINDS + 'fuego'; EnemyKind + 'elite3'; StructureKind + 'fire' (BUILD_COST { wood: 4, amber: 2 }, HP 60, label 'Hoguera')
// dungeon acts: 13 = enter the swamp root, 14 = leave it, 15/16 = its levers, 17 = take Fuego at its altar
// SavedPlayer.fuego?: boolean
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts dungeon act 17 (not 18), `power.kind` `'fuego'`, `place` kind `'fire'`. Act 13 far from the trunk does nothing; on a fish near it → inside, off the fish. Act 14 at the exit → beside the trunk. Both levers within 6 s → gate 0. Act 17 after gate 0 → `fuego` saved and in `self`. Walking into a shut gate → `fix`. On the boardwalk: standing on plank 0 for 1.2 s sinks it (`planks[0]` false), 4 s later it is back; dropping below the floor in the mud → back at z 89 with −10 PV and "El barro te traga…". Warm inside. Old save loads without `fuego`. Protocol v29.
- [ ] **Step 2: implement** (`swampLive`, `swampGates()`, `onSwampDungeon` acts 13–17, `stepSwampDungeon` for the planks and the mud, move validation through `clampStep(…, swampGates)`, `climbables()` includes the up planks, snapshot view).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): mazmorra del Pantano en el servidor (protocolo v29)`.

### Task 3: The Llamarada on the server (and the S3-E markers)

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** Without Fuego → "Aún no tienes ese poder"; cooldown 5 s separate from the others. A wolf 4 m ahead → −6, burning, then 3 PV/s for 4 s (≈ −18 more), and it runs away from the caster for 2 s; one behind untouched. A brute burns but does not flee. The thorn gate: two casts leave it shut, the third opens gate 1. Gas lamps: lit one by one within 10 s → gate 2; a lamp lit more than 10 s before the last does not count. Candiles: a Llamarada at a brazier lights it without a torch; all three → open. Turba: three casts at the wall → its orb can be taken (and gives ámbar). A cast within 5 m of zone 11's root cleanses it with "El fuego seca la raíz marchita. El pantano respira"; zone 10 never.
- [ ] **Step 2: implement** (`onFlame`; `l.fireReadyAt`; `Wolf.burn/flee/fleeFrom`; `stepBurning(dt)` for every foe; `flee` generalised to a point; `shrineLive.burns`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la Llamarada del Fuego`.

### Task 4: Bruto de turba, the ready boss room, and the hoguera

**Files:** Modify `src/shared/sim/elite.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.elite3` 480 PV, label), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `createPeat()` stands in its own room and `stepElite` keeps it there. In a mud pool it regrows 10 PV/s (to its max); burning, it does not. At 0 HP gate 3 opens ("La última verja se abre"); the room resets when empty. The boss room says "Algo zumba en la oscuridad. Aún duerme" once. Hoguera: placing one without Fuego is refused ("Hace falta el Fuego"); with Fuego and 4 wood + 2 ámbar it is built. A wolf stepping in burns; another wolf within 4 m flees; a second beast within 8 s does not trigger it; after 8 s it catches again; each catch costs 10 PV.
- [ ] **Step 2: implement** (`createPeat`, `stepPeatFight`, `stepFires`, `fireReady` map).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): bruto de turba y hoguera`.

### Task 5: Client — 3-way switching, the flame, the hoguera, the swamp interior

**Files:** Modify `src/client/input.ts`, `src/client/trap.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/touch.ts`, `src/client/dungeon-ui.ts`, `src/client/scene/structures.ts`, `src/client/scene/shrines.ts`; Create `src/client/scene/swamp-dungeon.ts`; Tests `input.test.ts`, `trap.test.ts`, `dungeon-ui.test.ts`.

- [ ] **Step 1: failing tests.** `nextPower` cycles enredadera → viento → fuego, skipping unowned. `KeyU` → `'fire'`. `nextTrap(t, fuego)` cycles estacas → red → hoguera only with Fuego. `swampDungeonAction`: near the Laguna trunk → `{13, 'Entrar en la Raíz-madre del Pantano'}`; exit → 14; levers → 15/16; altar after gate 0 without Fuego → 17. `peatBarText` shows "bruto de turba" and "· ardiendo".
- [ ] **Step 2: implement.** The pill icon shows 🔥; H with Fuego casts toward the aim point; an orange cone flash. The interior (floor, walls, gates, levers, altar orb in orange, thorn gate that shrinks with each burn, 3 lamps, mud strip + 10 planks that sink, two pools, exit ring), the trunk in the Laguna, the bruto de turba as the elite with a green-brown tint, burning enemies tinted orange. Hoguera mesh (stone ring + flame). The peat wall disappears when burnt. The Menú mentions U and Fuego.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del Fuego y de la mazmorra del Pantano`.

### Task 6: Ship

- [ ] Append "## Slice 3 · S3-E — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/resto`, one short comment on PR #3.
