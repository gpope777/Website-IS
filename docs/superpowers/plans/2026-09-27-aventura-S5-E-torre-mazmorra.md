# Aventura — Slice 5 · S5-E: la Torre (quinta mazmorra) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The fifth and last dungeon. The **tower door** (south face of `TOWER`, zone 18's plateau) lets you in once `towerOpen` (S5-D); before that A there says "Una raíz cierra la puerta. Rompan los Pilares" (or "…Él vendrá antes" once the 4 pillars are broken). Inside, an interior at **`x = HALF + 750`**, violet light, four floors, each **one power + one purified ally**:
1. **Enredadera + Tragón:** a thorn pit (gate 0). Two bare roots at its edge; an Enredadera grown at each makes a root bridge; with both, the pit is crossed for good. The white Tragón bites any beast within 4 m of you.
2. **Viento + Antenón:** 3 miasma vents; a gust into a vent clears it for 15 s; all three clear at once = gate 1 opens for good. The white Antenón blows a beast near you off the ledge every 5 s.
3. **Fuego + Zancudo:** a dark room with 4 braziers; a Llamarada lights each for good; all four = gate 2. The white Zancudo follows you with its farol (the light).
4. **Piedra + Cucurucho:** a rockfall lane (S4-E reuse, 3 lanes) and a plate on a 3 m shelf: weighted (a pillar, or someone on the shelf) = gate 3 open; it jams open once someone is through. The white Cucurucho stones a beast every 6 s.
5. **La Flecha** (mini-boss, 470 PV, id 900_008): arena 24 × 24 with 4 stone columns (her clavada sticks in them). Down = gate 4, 2 espinas negras to each fighter.
6. **The stair:** dying with `z ≥ stairZ` in the tower respawns you at the stair (the only checkpoint in the game).
7. **La Copa:** a round room (r 22), **empty and ready for S5-F** ("La Copa está vacía. Arriba solo hay cielo").

Floors 1, 2 and 4 wake beasts the first time someone alive walks in (2 wolves / 2 wolves / a wolf + a brute), once per server life. Every floor is solvable alone: bridges, vents (Viento cooldown 6 s < 15 s window), braziers and the plate (a pillar) need nobody else; the allies only help.

**Architecture:** Pure rules in a new `src/shared/tower-dungeon.ts` (`TOWER_DUNGEON` layout, `inTowerDungeon`, `insideTower`, `clampTowerDungeon`, `towerEntrance`, `towerShelfCrag`, `towerFloor`, `inArena`, `inCopa`, `TOWER_ROCKFALL`) and `src/shared/sim/tower-allies.ts` (`TOWER_ALLY`, `createTowerAlly`, `stepTowerAlly`). `boulders` / `rockfallLane` in `mountain-dungeon.ts` gain an optional corridor config so the tower reuses them. `dungeon.ts`'s `inAnyDungeon`, `withDungeon` and `clampStep` cover the fifth interior. Tower beasts live in `this.wolves` (dawn keeps them; in the tower they hunt with `fires: false`, since the interior counts as warm) and are clamped to the tower after each step. La Flecha in the tower is her own field (`towerFlecha`) stepped with `stepFlecha` and the columns as structures.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §9 (La Flecha in the tower), §11.1–11.2, §16.1 (ids), §16.2, §16.4 (checkpoint), §17 (row S5-E).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`villainTower`, `lieutenant3`, `bossForestShort`, `bossCoast`, `bossSwamp`, `bossMountain`, `thorn`).
- **Phones first. Touch grid stays at 10 pills.** Enter / leave are the contextual **A** (acts 26 / 27). Every puzzle is solved with the power pill (no new acts).
- **Trust boundary:** every client message through `decodeClient` (`dungeon` acts up to 27). The server checks `towerOpen`, reach to the door and the exit, that casts land inside the tower, gates, and who stands where.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 50 → 51 once for the whole plan: `dungeon` acts 26–27; `DungeonView.tower: TowerDungeonView` (gates, bridges, vents, braziers, plate, flecha bar, allies). No new saved field: the tower's state is live-only (like every dungeon), the checkpoint reads the death spot. Old saves load.
- **[D] Flat floors.** The "going up" is drawn (steps between floors), not walked: every floor is at y 30 like the other interiors. Rockfall, plate and arena reuse the S4-E rules unchanged.
- **[D] Layout** (interior-relative, z along the corridor, half width 12): entry z 5 · F1 z 8–44 (pit z 18–28, gate 0 at 18, roots at x ±6, z 15) · F2 z 48–84 (vents (−8, 70), (0, 74), (8, 70), gate 1 at 84) · F3 z 86–124 (braziers (±9, 96), (±9, 114), gate 2 at 124) · F4 z 126–164 (rockfall z 128–148, shelf (8, 156), gate 3 at 164) · arena z 169–193 (centre 181, columns (±6, 175), (±6, 187)), gate 4 at 198 · stair z 198–204 (checkpoint (0, 201)) · la Copa: disc r 22 centred at z 222. The spec's "24 × 230" rectangle becomes the corridor + the round Copa (the spec's r 22 does not fit in 24 m).
- **[D] Pit:** crossing needs **both** bridges (n/2); once crossed it stays crossable anywhere (no per-bridge collision).
- **[D] Braziers:** Llamarada only (every player here has Fuego; the Candiles torch does not come in).
- **[D] Allies** exist only if their boss was purified (`purified`, `purified2`, `purified3`, `purified4`); they stand at their floor's centre and follow the nearest live player on that floor (2.5 m behind); they cannot be hurt.
- **[D] Checkpoint:** positional, no flag: dead in the tower at `z ≥ stairZ` → respawn at the stair. A server restart loses the dead body's spot anyway (respawn at the Heart).
- **[D] La Flecha** in the tower: `raid: false`, 470 PV, lives while someone alive is in the arena; an empty arena resets her; beaten stays beaten (live-only). Her dash is clamped to the arena.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — the tower interior and its allies (shared)

**Files:** Create `src/shared/tower-dungeon.ts` (+ test), `src/shared/sim/tower-allies.ts` (+ test); Modify `src/shared/mountain-dungeon.ts` (`boulders`/`rockfallLane` optional corridor), `src/shared/dungeon.ts` (+ test), `src/shared/sim/elite.test.ts` (ids).

**Interfaces:**
```ts
export const TOWER_DUNGEON = { x: HALF + 750, z0: 0, z1: 244, halfW: 12, floor: 30, pad: 10, entryZ: 5, exitReach: 2.5, doorReach: 5,
  gatesZ: [18, 84, 124, 164, 198], pit: [18, 28], roots: [{ x: -6, z: 15 }, { x: 6, z: 15 }], rootReach: 4,
  vents: [{ x: -8, z: 70 }, { x: 0, z: 74 }, { x: 8, z: 70 }], ventClear: 15, braziers: [{ x: -9, z: 96 }, { x: 9, z: 96 }, { x: -9, z: 114 }, { x: 9, z: 114 }],
  shelf: { x: 8, z: 156, r: 2.5, h: 3 }, plateR: 1.5, arena: { z: 181, half: 12 }, columns: [{ x: -6, z: 175 }, { x: 6, z: 175 }, { x: -6, z: 187 }, { x: 6, z: 187 }],
  stairZ: 198, stair: { x: 0, z: 201 }, copa: { z: 222, r: 22 }, copaZ: 204, floors: [[8, 44], [48, 84], [86, 124], [126, 164]], shelfId: 1500, flechaHp: 470, flechaId: 900_008 } as const;
export const TOWER_ROCKFALL = { x: TOWER_DUNGEON.x, span: [128, 148] } as const;
export function inTowerDungeon(x, z, pad = 0): boolean;             // corridor up to copaZ, or the Copa disc
export function insideTower(p): { x; z };
export function clampTowerDungeon(px, pz, nx, nz, gates): { x; z }; // walls, shut gates both ways, the Copa's round wall
export function towerEntrance(): { x: number; z: number };         // TOWER's south face
export function towerShelfCrag(): Crag;
export function towerFloor(x, z): number;                           // 0–3 floor index, 4 arena, 5 stair/Copa, −1 outside
export function inArena(x, z): boolean; export function inCopa(x, z): boolean;
// mountain-dungeon.ts: boulders(t, lane, blockers, c = { x: M.x, span: M.rockfall }), rockfallLane(x, cx = M.x)

export const TOWER_ALLY = { follow: 2.5, run: 5.5, reach: 4, tragon: { damage: 25, every: 1.2 }, antenon: { every: 5, reach: 6 }, cucurucho: { damage: 30, every: 6, range: 15 } } as const;
export type TowerAllyKind = 'tragon' | 'antenon' | 'zancudo' | 'cucurucho';
export function createTowerAlly(kind, at: { x: number; z: number }, y: number): TowerAlly;
export function stepTowerAlly(a, players: {x;z}[], foes: Wolf[], dt): { foe: Wolf; damage: number } | null;  // antenon: damage = foe.hp (off the ledge)
```
- [ ] **Step 1: failing tests.** `inTowerDungeon` true at the entry and in the Copa's centre, false just past the corridor wall and outside the Copa disc. `clampTowerDungeon` stops a shut gate both ways, passes an open one, keeps you inside the Copa's circle. `towerEntrance` is 14 m south of `TOWER`. `towerFloor` gives 0–3, 4 in the arena, 5 in the Copa. `boulders` with `TOWER_ROCKFALL` gives a boulder at z 148 at a lane's spawn; old calls unchanged. `withDungeon(t).heightAt` inside the tower is 30; `clampStep(…, towerGates)` delegates; `inAnyDungeon` true. Tragón bites a wolf within 4 m of a player (25) and waits 1.2 s; Antenón returns the foe with damage = its hp every 5 s; Zancudo never attacks; Cucurucho hits for 30 within 15 m every 6 s; each follows the nearest player. Special ids stay distinct with 900_008.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la Torre y de sus aliados blancos`.

### Task 2: The tower on the server — door and the four floors (protocol v51)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/client/dungeon-ui.ts` (empty view only); Tests `protocol.test.ts`, `world-sim.test.ts` (version), new `src/shared/sim/world-sim-s5e.test.ts`.

**Interfaces:**
```ts
// PROTOCOL_VERSION 51; dungeon acts 26 enter the tower, 27 leave
export interface TowerDungeonView { gates: boolean[]; bridges: boolean[]; vents: boolean[]; braziers: boolean[]; plate: boolean;
  flecha: { hp: number; max: number; aiming: boolean; stuck: boolean } | null; allies: (AllyView & { kind: TowerAllyKind })[] }
```
- [ ] **Step 1: failing tests.** `decodeClient` takes act 27, refuses 28. Before `towerOpen`, act 26 at the door says "Una raíz cierra la puerta. Rompan los Pilares"; with 4 pillars broken "Una raíz cierra la puerta. Él vendrá antes"; open → inside at the entry; act 27 → out 4 m south of the door. Enredadera near root 0 → "Una raíz cruza el foso (1/2)"; both → gate 0. Gusts into the 3 vents within 15 s → gate 1; one vent alone reopens after 15 s. Four Llamaradas at the braziers → gate 2. A pillar at the shelf → gate 3; someone past it jams it. Boulders hit in the tower's lanes. Protocol 51.
- [ ] **Step 2: implement** (`towerLive`, `onTowerDungeon`, `towerGates`, `stepTowerDungeon`; Enredadera/Viento/Fuego/Piedra hooks; `offMap` of Enredadera knows the tower).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la puerta de la Torre y sus cuatro pisos (protocolo v51)`.

### Task 3: Beasts and white allies on each floor

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim-s5e.test.ts`.
- [ ] **Step 1: failing tests.** The first live player on floor 1 wakes 2 wolves there (once); tower wolves hunt a player in the tower (not scared by the "warm" interior) and stay inside the walls; dawn does not clear them. With `purified` the Tragón appears on floor 1 and bites a wolf near you; without it, no ally. The Antenón removes a beast; the Cucurucho stones one; the Zancudo follows you. `snap.dungeon.tower.allies` lists them.
- [ ] **Step 2: implement** (`spawnTowerBeasts`, tower branch in the wolf loop + clamp, `stepTowerAllies`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): bestias y aliados blancos en los pisos de la Torre`.

### Task 4: La Flecha, the stair checkpoint and the empty Copa

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim-s5e.test.ts`.
- [ ] **Step 1: failing tests.** Someone alive in the arena wakes La Flecha (id 900_008, 470 PV, `lieut3`); she is hit by attacks, gusts and flames; her clavada sticks in a column; she never leaves the arena; empty arena → gone and back at full PV. Beaten: gate 4 opens, +2 espinas negras to fighters, she does not come back. Dying on the stair or in the Copa → respawn at the stair; dying on floor 2 → the Heart. The first one into the Copa hears "La Copa está vacía…".
- [ ] **Step 2: implement** (`towerFlecha`, `stepTowerFlecha`, `enemy()`/foe lists/snapshot, `onRespawn` checkpoint, `// S5-F` marker in the Copa).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): La Flecha en la Torre y el punto de guardado de la escalera`.

### Task 5: Client — the tower interior

**Files:** Create `src/client/scene/tower-dungeon.ts`; Modify `src/client/dungeon-ui.ts` (+ test), `src/client/game.ts`.
- [ ] **Step 1: failing tests** (`dungeon-ui.test.ts`): `towerDungeonAction` offers "Entrar en la Torre" at the door, "Salir de la Torre" at the entry, nothing elsewhere; `flechaBarText` shows PV and "¡raya!" / "clavada".
- [ ] **Step 2: implement:** walls, violet light, gates, the pit + 2 bridges, 3 vent puffs (fade when clear), 4 braziers (flame when lit), dim floor 3, rockfall boulders, shelf + plate, 4 columns, drawn steps between floors, the Copa disc; allies as pale PaperActors (the Zancudo with its farol glow); `clampStep` gets the tower gates; the Flecha bar.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de la Torre`.

### Task 6: Ship

- [ ] Push `aventura/resto`; append "Slice 5 · S5-E" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. Never merge.
