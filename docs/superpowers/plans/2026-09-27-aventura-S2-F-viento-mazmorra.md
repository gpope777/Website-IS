# Aventura — Slice 2 · S2-F: mazmorra de la Costa y el Viento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The second dungeon and the second power. The **Raíz-madre de la Costa** stands on the dungeon island (only the whale gets you there); A on its trunk enters an interior at **`x = HALF + 300`** (24 × 180 m). Inside: **levers** → **altar: Viento** → **fan-gate** (a gust opens it) → **pumice block across a 10 m channel onto a plate** (gust it; players cross a narrow bridge) → **updraft chasm** (20 m pit: glide + the gust's +6 m boost; falling puts you back at the edge with −10 PV) → **bruto escudado** (420 PV, front shield; a gust spins it: 3 s exposed; a parry exposes it too) → the boss room, **empty and ready for S2-G**. **Viento** (H / power pill): cone 8 m × 70°, cooldown 6 s; enemies pushed 6 m, stunned 1 s, 5 damage (Marchito/bosses/elites pushed 2 m); raiders and wolves pushed into deep sea die ("Se los lleva el mar", max 3 per gust), off a >3 m ledge take 20; pumice blocks slide 6 m; fan-gates open; gliding, once per flight, +6 m. **Switching:** H casts, **J** switches; on touch, tap the power pill casts and **holding it 0.5 s** switches (icon 🌿/🌬️).

**Also resolves the `// S2-F` markers:** the Islote shrine's fan-gate opens to a gust (solo-able), Marea's pumice block slides when gusted, and a gust within 5 m of a coast zone's withered root (zones 7–9) cleanses it.

**Architecture:** Pure rules in two new shared modules, used by both `WorldSim` and the client: `src/shared/viento.ts` (`VIENTO`, `inGust`, `gustDir`, `slide`) and `src/shared/coast-dungeon.ts` (`COAST_DUNGEON` layout, `inCoastDungeon`, `inChasm`, `coastFloor`, `clampCoast`, `coastEntrance`). `dungeon.ts` gains `inAnyDungeon`; `withDungeon` and `clampStep` also cover the coast interior (the existing forest functions keep their meaning, so no forest code path changes). The coast dungeon's state is live-only (`coastLive`), like the forest one. The shielded brute reuses `stepElite` with a room box and an `exposed` timer (`src/shared/sim/elite.ts` gains `createShielded`).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §4 (Viento), §6.1 (Marea/Islote with Viento), §6.4 (cleansing by gust), §7.1–7.2 (coast dungeon), §11.2, §12 (row S2-F). The "Decisiones de Gabriel" block: power switch = **hold the power pill 0.5 s**; H casts, J switches.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`coastRoot`, `powerWind`, `eliteCoast`).
- **Phones first. Touch grid stays at 10 pills.** Entering/leaving, levers and the altar are the contextual **A**; the gust is the existing power pill (tap), switching is a 0.5 s hold on the same pill.
- **Trust boundary:** every client message through `decodeClient`. The server checks: owning Viento, its own cooldown, reach, the cone, gates, the channel/bridge, the pit, the boost (once per flight, ≤ +6.5 m for 2 s).
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 18 → 19: `dungeon` acts 8–12, `power.kind?`, `DungeonView.coast`, `SelfState.viento` / `windLeft`, `EnemyKind` `'elite2'`. New saved field `SavedPlayer.viento?` only: old saves load.
- **[D] Two dungeons without a list refactor.** The forest's `DUNGEON`, `inDungeon` and friends keep meaning "the forest interior"; the coast has its own constant and helpers, and `inAnyDungeon` covers what both share (warmth, no mounts, move bounds). Fewer touched lines than `DUNGEONS[i]` everywhere.
- **[D] Four coast gates** (levers, fan, plate, shielded brute). The chasm needs no gate: the pit is the obstacle.
- **[D] Channel:** a 10 m strip players cannot walk into except over a 2.5 m bridge along the west wall; the block is never carried here (gust only) and floats across.
- **[D] Chasm fall:** under the pit's lip by 4 m → back at the near edge with −10 PV ("El hueco te escupe").
- **[D] Power choice is client-side** and sent as `power.kind` (`'enredadera' | 'viento'`, absent = enredadera for old clients). Each power has its own cooldown.
- **[D] Ledge push:** a push that ends ≥ 3 m lower costs 20 PV. Spikes and nets work on their own (the raider stands on them).
- **[D] Water kills:** raiders and wolves only, where the sea is deeper than `SWIM_MAX_DEPTH`; at most 3 per gust.
- **[D] Shielded brute:** hits from its front half are blocked ("El escudo para el golpe") unless exposed; a gust in its cone turns it around and exposes it 3 s; a parry exposes it 3 s too.
- **[D] Boss room:** reachable once the brute falls; nothing lives there yet ("Algo duerme bajo la marea"). S2-G fills it.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — Viento and the coast interior (shared)

**Files:** Create `src/shared/viento.ts`, `src/shared/viento.test.ts`, `src/shared/coast-dungeon.ts`, `src/shared/coast-dungeon.test.ts`; Modify `src/shared/dungeon.ts` (+ test).

**Interfaces:**
```ts
export const VIENTO = { range: 8, cone: (70 * Math.PI) / 180, cooldown: 6, push: 6, heavyPush: 2, stun: 1, damage: 5, ledge: 3, ledgeDamage: 20, waterKills: 3, boost: 6, boostFor: 2, slide: 6, rootReach: 5 } as const;
export function gustDir(px, pz, tx, tz): { x: number; z: number };           // unit vector, falls back to +z
export function inGust(px, pz, dir, x, z, range = VIENTO.range): boolean;     // within range and ±35°
export function slide(x, z, dir, dist): { x: number; z: number };

export const COAST_DUNGEON = { x: HALF + 300, z0: 0, z1: 180, halfW: 12, floor: 30, pad: 10, entryZ: 5, exitReach: 2.5,
  gatesZ: [32, 56, 86, 150], levers: [{ x: -9, z: 22 }, { x: 9, z: 22 }], leverReach: 2.5, leverWindow: 6,
  altarZ: 44, altarReach: 2.5, fan: { x: 0, z: 56 }, blockStart: { x: 4, z: 61 }, channel: [66, 76], bridgeX: -9.5,
  plate: { x: 4, z: 81 }, plateRadius: 1.6, pit: [96, 116], pitDepth: 20, fallBelow: 4, fallBack: 93, fallDamage: 10,
  eliteRoomZ: 120, eliteZ: 136, bossRoomZ: 150, trunkR: 4, enterReach: 5 } as const;
export function inCoastDungeon(x, z, pad = 0): boolean;
export function coastFloor(x, z): number;           // floor, minus pitDepth over the chasm
export function inChasm(x, z): boolean;
export function clampCoast(px, pz, nx, nz, gates: readonly boolean[]): { x: number; z: number }; // walls, shut gates, the channel except the bridge
export function coastEntrance(seed): { x: number; z: number };   // on the dungeon island, 5 m north of its centre
// dungeon.ts: inAnyDungeon(x, z, pad?); withDungeon also returns coastFloor inside the coast pad; clampStep(…, gates, coastGates = []) delegates to clampCoast inside it.
```
- [ ] **Step 1: failing tests.** `inGust`: straight ahead at 7 m yes, 9 m no, 40° off no, behind no. `slide` moves 6 m along the direction. `inCoastDungeon` true at the entry, false in the forest interior and vice versa for `inDungeon`. `coastFloor` = 30 in rooms and 10 in the pit. `clampCoast`: a step into the channel at x = 0 stays on the near side; at x = −10.5 (bridge) it passes; shut gate 1 blocks, open passes; the wall clamps x. `withDungeon(t).heightAt` inside the coast pad is `coastFloor`. `clampStep` delegates. `coastEntrance` lies on the island (dry).
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas del Viento y de la mazmorra de la Costa`.

### Task 2: Coast dungeon on the server — enter, levers, altar, chasm (protocol v19)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
export interface CoastDungeonView { gates: boolean[]; levers: boolean[]; block: { x: number; z: number }; plate: boolean; elite: { hp: number; max: number; exposed: boolean } | null }
// DungeonView.coast: CoastDungeonView; SelfState.viento: boolean; SelfState.windLeft: number
// ClientMsg power: { t: 'power'; x; z; kind?: 'enredadera' | 'viento' }
// dungeon acts: 8 = enter the coast root, 9 = leave it, 10/11 = coast levers, 12 = take Viento at the altar
// SavedPlayer.viento?: boolean
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts dungeon act 12 (not 13), `power.kind` viento/enredadera, rejects another kind. Act 8 far from the trunk does nothing; near it (a whale passenger too) → inside the coast interior, off the whale. Act 9 at the exit → beside the trunk. Both levers within 6 s → gate 0. Act 12 after gate 0 → `viento` saved, `self.viento`. Walking into a shut gate or the channel off the bridge → `fix`. Stepping into the pit and dropping 4 m under the lip → back at z = 93 with −10 PV. Warm inside. Old save loads without `viento`. Protocol v19.
- [ ] **Step 2: implement** (`coastLive` state, `coastGates()`, `onDungeon` acts 8–12, move validation through `clampStep(…, coastGates)` and `inAnyDungeon`, `stepCoastDungeon` for the pit and the plate).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): mazmorra de la Costa en el servidor (protocolo v19)`.

### Task 3: The Viento gust on the server (and the S2-F markers)

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** Without Viento → "Aún no tienes ese poder"; cooldown 6 s is separate from Enredadera's. A wolf 5 m ahead → pushed ~6 m, stunned, −5 HP; one behind untouched. A raider pushed from the beach edge into deep sea dies ("Se los lleva el mar"); a 4th in the same gust survives. The elite / boss / Marchito move ≤ 2 m. The coast block slides 6 m; three gusts carry it over the channel onto the plate → gate 2 open. A gust at the fan → gate 1 open. Islote shrine: a gust at its wheels opens it (solo). Marea: a gust slides the pumice (not while held). A gust at a coast root (zone 7) within 5 m cleanses it; zone 6 never. Gliding (y well above ground): first gust grants a move up to +6 m, the second in the same flight does not; landing resets it.
- [ ] **Step 2: implement** (`onPower` branches on `kind`; `onGust`; `l.windReadyAt`, `l.boostCeil`, `l.boostUntil`, `l.boosted`; `yOk` accepts `m.y <= boostCeil` while it lasts).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la ráfaga del Viento`.

### Task 4: The shielded brute and the ready boss room

**Files:** Modify `src/shared/sim/elite.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.elite2`, label), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `stepElite` keeps the shielded brute inside its own room box. A punch from the front → blocked, no HP lost; from behind → lands. A gust → turns it (yaw + π) and exposes 3 s: front punches land. A parry exposes it. At 0 HP gate 3 opens ("La última verja se abre"); the room resets when empty. The boss room is reachable and says "Algo duerme bajo la marea" once.
- [ ] **Step 2: implement** (`Elite.box`, `Elite.exposed`, `createShielded()`, `stepShieldFight`, `strike` checks the shield using the striker's position).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el bruto escudado`.

### Task 5: Client — switching, the gust, the boost, the coast interior

**Files:** Modify `src/client/input.ts`, `src/client/touch.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/dungeon-ui.ts`, `src/client/movement.ts`, `src/client/scene/dungeon.ts`; Tests `input.test.ts`, `dungeon-ui.test.ts`, `movement.test.ts`.

- [ ] **Step 1: failing tests.** `KeyJ` → `'switch'`. `nextPower(current, owns)` cycles only through owned powers. `coastDungeonAction`: near the island trunk → `{8, 'Entrar en la Raíz-madre de la Costa'}`; inside at the exit → 9; at a lever → 10/11; at the altar after gate 0 without Viento → 12. `boost(b)` adds 6 m of lift once per flight and resets on landing.
- [ ] **Step 2: implement.** J switches; the power pill: tap casts, hold 0.5 s switches (fires `'switch'`), label shows 🌿/🌬️; the Menú lists "H poder · J cambiar". Casting Viento while gliding boosts locally. A brief white cone flash on a gust. The coast interior (floor, walls, pit, channel water strip + bridge, fan with spinning blades, block, plate, levers, altar orb in white, exit ring), the trunk on the island, the shielded brute drawn like the elite with a blue shield board, and its HP bar ("bruto escudado · ¡expuesto!").
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del Viento y de la mazmorra de la Costa`.

### Task 6: Ship

- [ ] Append "## Slice 2 · S2-F — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/slice-1`, one short comment on PR #2.
