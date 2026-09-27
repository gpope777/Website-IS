# Aventura — Cierre del Slice 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Slice 1 with Gabriel's four decisions (handoff, "Decisiones de Gabriel"): (1) balance — spikes that matter, a Tragón that no longer kills a still player in 12 s, an El Marchito sized for 1–4 players; (2) a second trap, the **red de raíces**, that holds raiders in place; (3) **corruption by zones** in the forest: purple patches with more and tougher beasts, purified by progress, feeding the raid direction; (4) a longer **Raíz-madre**: four puzzles and a mini-boss (the reinforced bruto marchito with a telegraphed charge) before the Tragón.

**Architecture:** Balance is constants plus a `slow` field on `Wolf` (spikes set it, `stepWolf`/`stepRaider` honour it) and a per-invasion voluntad (`marchitoWill(players)`). The net is a new `StructureKind 'roots'` with a live-only rearm map in `WorldSim`. Zones live in `src/shared/corruption.ts` (seeded circles, deterministic on client and server); the sim keeps a saved `cleansed?: number[]` and the snap carries the ids still corrupt. The dungeon trazado in `src/shared/dungeon.ts` grows from one gate to five (`gates: boolean[]`), with a carried block, a carried lantern, a knot that Enredadera opens and the mini-boss in `src/shared/sim/elite.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §3 (corruption, raids by direction), §4 (traps), §5 (bosses are puzzles), §7 (dungeon: puzzles solvable solo and co-op, mini-boss). Plan map: see Plan A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice.
- **Phones first. The touch grid stays at 10 pills.** The net uses a new key (**Y**) and, on touch, the 🗡️ pill becomes **"trampa"**: it places the selected trap; the Menú has a "Trampa: estacas / red de raíces" toggle (also on the keyboard: T = estacas, Y = red). Dungeon interactions (block, lantern, brazier) use the contextual A / E.
- **Trust boundary:** every client message through `decodeClient`; the server validates reach, carry state, gates.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 9 → 10 (`'roots'`), Task 3 → 11 (`snap.corrupt`), Task 4 → 12 (dungeon view, `'elite'`, new acts). New saved fields are optional (`SavedWorld.cleansed?`): old saves load.
- Simplest option when ambiguous; write the decision in the handoff.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Balance — spikes, Tragón, El Marchito

**Files:** Modify `src/shared/sim/wolves.ts`, `src/shared/sim/boss.ts`, `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts`; Tests `wolves.test.ts`, `boss.test.ts`, `marchito.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
export const SPIKES = { radius: 1.8, dps: 40, wear: 4, slow: 0.3 } as const;   // was 1.3 / 25 / 4
// Wolf gains `slow: number` — seconds left slowed; run speed × SPIKES.slow while > 0.
// ENEMY.boss = { hp: 300, run: 2.8, damage: 12, reach: 3.2, biteCooldown: 3.2 }; BOSS.windup 0.7 → 0.9
// ENEMY.marchito = { hp: 660 (the most), run: 2.6, damage: 14, reach: 3, biteCooldown: 3 }
export function marchitoWill(players: number): number   // 180 + 120·clamp(n,1,4): 300 / 420 / 540 / 660
// Marchito gains `max: number`; createMarchito(x, y, z, prey, will = ENEMY.marchito.hp)
```
- [ ] **Step 1: failing tests.**
  - A raider walking straight over spikes (no position reset) takes ≥ 60 damage: a wolf dies crossing them.
  - `stepRaider` with `slow > 0` moves `run × SPIKES.slow`.
  - A still player next to the Tragón (`stepBoss` only, no guard) takes < 100 damage in 30 s.
  - `marchitoWill(1..4)` and `createMarchito(..., will)` sets `hp` and `max`; the snap's `marchito.max` equals the voluntad at arrival.
  - The old spike test is updated to the new rule (no teleporting the wolf): noted as an intentional rule change.
- [ ] **Step 2: implement.** `stepSpikes` sets `w.slow = 0.5` for wolves inside the radius; `stepWolf`/`stepRaider` decay `slow` and multiply speed. `startInvasion` uses `marchitoWill(activeCount())`; `MarchitoView.max = m.max`.
- [ ] **Step 3:** all green, self-review, commit `balance(aventura): estacas que frenan, Tragón y Marchito más justos`.

### Task 2: Red de raíces (second trap)

**Files:** Modify `src/shared/items.ts`, `src/shared/protocol.ts` (v10), `src/shared/sim/world-sim.ts`, `src/client/input.ts`, `src/client/touch.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/scene/structures.ts`; Tests `items.test.ts`, `protocol.test.ts`, `world-sim.test.ts`, `input.test.ts`, new `src/client/trap.test.ts` + `src/client/trap.ts`.

**Interfaces:**
```ts
// StructureKind += 'roots'; STRUCTURE_LABELS.roots = 'Red de raíces'; BUILD_COST.roots = { wood: 4, berries: 2 }; STRUCTURE_HP.roots = 60
export const NET = { radius: 1.6, hold: 3, rearm: 5, wear: 15 } as const;  // world-sim.ts
// input: Action += 'net' (KeyY), 'trap' (touch pill, places the selected trap)
export type TrapKind = 'spikes' | 'roots';
export function nextTrap(t: TrapKind): TrapKind;   // client/trap.ts
export const TRAP_LABEL: Record<TrapKind, string>;
```
- [ ] **Step 1: failing tests.** A raider stepping inside a net is held (`stun = NET.hold`, doesn't move) and the net loses `NET.wear`; a second raider in the next 5 s is not caught (rearm); after `rearm` it catches again; the net is wrecked at 0 HP. Placing costs 4 madera + 2 bayas. `decodeClient` accepts `place` with `'roots'`. `KEY_ACTIONS.KeyY === 'net'`. `nextTrap('spikes') === 'roots'`.
- [ ] **Step 2: implement.** `stepNets` next to `stepSpikes`, rearm times in a live-only `Map<number, number>`. Client: net mesh (flat woven roots), pill `🗡️ trampa` fires `'trap'` → `place(selected)`; menu toggle button changes the selection and the pill label; key T/Y still place spikes/net directly. Build text "Red de raíces tendida".
- [ ] **Step 3:** green, self-review, commit `feat(aventura): red de raíces, la segunda trampa`.

### Task 3: Corruption by zones

**Files:** Create `src/shared/corruption.ts` + test; Modify `src/shared/protocol.ts` (v11), `src/shared/sim/world-sim.ts`, `src/client/game.ts`, `src/client/scene/terrain-mesh.ts` (tint), new `src/client/scene/corruption.ts` (the withered root at each zone's centre).

**Interfaces:**
```ts
export interface Zone { id: number; x: number; z: number; r: number }
export const CORRUPTION = { count: 6, rMin: 22, rMax: 32, cleanseReach: 5, extraWolves: 2 } as const;
export function generateZones(terrain: Terrain, seed: number, entrance: { x: number; z: number }): Zone[]; // zone 0 on the Raíz-madre, the rest seeded, biased toward it, ≥ 45 m from spawn
export function zoneAt(zones: readonly Zone[], x: number, z: number): Zone | undefined;
export function raidDirFrom(heart: { x: number; z: number }, zones: readonly Zone[], corrupt: readonly number[], fallback: number): number; // toward the nearest corrupt zone
// SavedWorld.cleansed?: number[]; snap.corrupt: number[] (ids still corrupt)
```
- [ ] **Step 1: failing tests.** Zones are deterministic and dry; zone 0 contains the entrance. Purifying: (a) the Tragón's defeat cleanses zone 0; (b) taking a shrine orb cleanses the zone nearest that shrine; (c) Enredadera cast within `cleanseReach` of a corrupt zone's centre cleanses it ("La raíz marchita se seca. El bosque respira"). Night wolves near a player inside a corrupt zone: `extraWolves` more, one of them a brute. The raid comes from the nearest corrupt zone; with none left, from the Raíz-madre and ×0,6. Old saves without `cleansed` load with every zone corrupt; `save()` round-trips.
- [ ] **Step 2: implement.** Client: vertex tint of the terrain toward purple inside corrupt zones (rebuilt colours when `corrupt` changes, cheap: only colours), a withered dark root with a violet glow at each corrupt centre, gone when cleansed. Raid text: "El cielo se tiñe de morado hacia la zona marchita…".
- [ ] **Step 3:** green, self-review, commit `feat(aventura): corrupción por zonas del bosque`.

### Task 4: Dungeon — four puzzles and the mini-boss (shared + server)

**Files:** Modify `src/shared/dungeon.ts`, `src/shared/protocol.ts` (v12), `src/shared/sim/wolves.ts` (`'elite'`), `src/shared/sim/world-sim.ts`; Create `src/shared/sim/elite.ts` + test; Tests `dungeon.test.ts`, `world-sim.test.ts`, `protocol.test.ts`.

**Layout (z along the interior, 24 m wide, z1 = 170):**
1. Hall (0–32): two root levers → gate 0 at z 32 (as today).
2. Altar (32–56): Enredadera at z 46. Gate 1 at z 56 is a **knot of roots**: Enredadera within 4 m of it opens it.
3. Plate room (56–84): plate at (−7, 66), a root **block** at (7, 62). Gate 2 at z 84 is open while the plate is pressed (a player on it or the block on it) and 3,5 s after. Solo: carry the block (A picks up / A drops). Co-op: a friend stands on it.
4. Dark room (84–110): a **lantern** at (0, 90); carry it to the brazier at (−8, 106), A → gate 3 at z 110 opens for good.
5. Mini-boss (110–138): **bruto marchito reforzado** at z 126; gate 4 at z 138 opens when it falls.
6. Tragón (138–170): boss at z 158.

**Interfaces:**
```ts
// DUNGEON gains gatesZ: [32, 56, 84, 110, 138], knot, plate, blockStart, lantern, brazier, eliteZ, eliteRoomZ; bossRoomZ = 138; bossZ = 158; z1 = 170
export function clampStep(px, pz, nx, nz, gates: readonly boolean[]): { x: number; z: number }  // was gateOpen: boolean
// ClientMsg dungeon act: 5 = pick up / drop the block, 6 = pick up / drop the lantern, 7 = light the brazier
// DungeonView { gates: boolean[]; levers; purified; boss; block: {x,z,held:string|null}; lantern: {x,z,held:string|null}; plate: boolean; elite: {hp,max,charging} | null }
// EnemyKind += 'elite': { hp: 420, run: 3.4, damage: 18, reach: 2.4, biteCooldown: 2 }
export const ELITE = { id: 1, windup: 1.1, chargeSpeed: 13, chargeFor: 0.9, chargeDamage: 30, chargeHit: 1.8, chargeMin: 5, chargeMax: 14, chargeCooldown: 5 } as const;
export function stepElite(e: Elite, targets: readonly WolfTarget[], dt: number): string | null; // bite or charge victim
```
- [ ] **Step 1: failing tests.** Can't pass any shut gate (clamp); lever pair opens gate 0; Enredadera near the knot opens gate 1; standing on the plate opens gate 2, and so does the dropped block; the block and lantern follow their carrier; the lantern at the brazier opens gate 3; only one thing carried at a time; the elite telegraphs (windup, `charging`) before a charge, the charge hits a player in its line for `chargeDamage`, rolling dodges it; the elite's death opens gate 4; an empty room resets it at full HP; the Tragón still works in the new room. Old tests adapted to the new layout (noted).
- [ ] **Step 2: implement.** Carried items live in `dungeonLive`; dropping a carried thing puts it at the carrier's feet; a carrier who leaves the dungeon or dies drops it. Gate 1 in `onPower`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): mazmorra con cuatro acertijos y mini-jefe`.

### Task 5: Dungeon — client

**Files:** Modify `src/client/dungeon-ui.ts` (+test), `src/client/scene/dungeon.ts`, `src/client/game.ts`.
- [ ] Contextual A: "Coger el bloque" / "Soltar el bloque", "Coger la linterna" / "Soltar la linterna", "Encender el brasero". Five gates drawn (bars; the knot as a thick twisted root), plate that sinks when pressed, block box, lantern (point light) following its carrier, brazier that burns when lit, a dim dark room. Elite drawn like the brute at scale 2.4 and reddish; bar "Bruto reforzado 300/420 · ¡carga!".
- [ ] Tests for `dungeonAction` (block/lantern/brazier labels) and `eliteBarText`. Green, commit `feat(aventura): cliente de la mazmorra ampliada`.

### Task 6: Ship

- [ ] Append "## Cierre Slice 1 — …" to `docs/superpowers/HANDOFF-aventura.md` (commits, tests, decisions, blockers, qué probar).
- [ ] Commit, `git push origin aventura/slice-1`, one short comment on PR #2. No merge, no deploy.
