# Aventura — Slice 5 · S5-B: rayos marchitos, bestias de ceniza, espinas negras, arma 6 / Capa 4 y la fogata de la Ceniza — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give las Tierras Corruptas something to fight and a reason to come back. A new flying enemy, the **rayo marchito** (`public/enemies/enemy11.png`, purple paper, 60 PV), hovers 6 m over the Espinar and dives at players (0.8 s white flash, 10 damage). Arrows reach it; the sword only when it is low; a Viento gust knocks it down for 3 s. The usual wolves and brutes up here are **ash beasts**: they drop **1 espina negra** (the rayo 50 %). Espinas buy the last gear tier at the Heart: **arma nivel 6** (6 espinas + 3 cuarzo + 10 piedra, +90 % total) and **Capa nivel 4** (4 espinas + 2 ámbar, −40 %). **Fogata 6, la Ceniza**, a stone ring on the ash plain: lit like the others, Heart ↔ Ceniza by day, and at it the Menú **calls your own deer, frog or fish** there.

**Architecture:** `items.ts` gains `'thorn'`, a third upgrade cost row (`costTop`) and `capaCost(lvl)`. A new `src/shared/sim/rayo.ts` holds `RAYO` and the pure `stepRayo` (hover → tell → dive → climb, grounded after a gust). `corrupt-lands.ts` gains `ASH` (day spawns), `cenizaFogata(t)`, `callSpot(beast, …)` and `thornDrop(kind, x, z, roll)`. `fogatas.ts` appends fogata 6 (`FOGATA.count` 7). Server (`world-sim.ts`): day spawns in the Espinar once per game day while the fog is open and someone is up there; rayos stepped with `stepRayo`; melee on a high rayo refused with a hint; gusts ground rayos; kills in `inCorrupt` drop espinas; the new `{ t: 'call', beast }` message. Client: rayo paper cutouts, the Ceniza ring (the existing fogata meshes), upgrade/Capa labels from the cost tables, Menú buttons "Llamar al ciervo/a la rana/al pez".

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §4 (calling), §7.1–7.4, §16.2–16.3, §17 row S5-B.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Proper names through `NAMES` (`thorn`, `flier`, `ash`, `thornland`, `blackLake` exist since S5-A).
- **Phones first. Touch grid stays at 10 pills.** No new pill: shooting a rayo is the bow pill, hitting a grounded one the attack (A); calling a mount is a Menú button at the lit Ceniza fogata (like the Heart's "Ir a la fogata N").
- **Trust boundary:** the client sends `{ t: 'call', beast }` through `decodeClient`; the server checks fogata 6 lit, reach, ownership, not riding it, alive, outside dungeons. Melee on a rayo is re-checked by height on the server.
- **Protocol:** Task 1 bumps 44 → 45 (new `EnemyKind` `'rayo'`, `ItemId` `'thorn'`, upgrade/Capa caps and `FOGATA.count` change what the server accepts). Task 3 bumps 45 → 46 (`call`). No new saved fields: `SavedWorld.fogatas` of 6 loads with la Ceniza dark; `weaponLvl`/`capaLvl` simply go higher. Old saves load.
- **Enemy ids:** rayos and ash beasts are normal wolf ids (`nextWolfId`), no special id (the unique-ids test is untouched).
- **Out of this plan:** rayos in raids / against structures and the dragon's zarpazo (S5-D), the 3 rayo guards of the Pilar de Fuego (S5-C), the Lago Negro's water (S5-C), zones 18–21 (S5-C).
- **Mobile performance:** rayos are PaperActors like the lieutenants (1 card + 1 shadow each), cap **8 alive** from the day spawns. The Ceniza ring reuses the fogata meshes (+~9 small meshes).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — espina negra, arma 6 / Capa 4, the rayo, fogata 6 (protocol v45)

**Files:** Modify `src/shared/items.ts`, `src/shared/protocol.ts`, `src/shared/fogatas.ts`, `src/shared/corrupt-lands.ts`, `src/shared/sim/wolves.ts`; Create `src/shared/sim/rayo.ts`, `rayo.test.ts`; Tests `items.test.ts`, `fogatas.test.ts`, `corrupt-lands.test.ts`, `protocol.test.ts`.

**Interfaces:**
```ts
// items.ts
export type ItemId = … | 'thorn';                 // label: NAMES.thorn plural "Espinas negras"
export const UPGRADE = { …, costTop: { thorn: 6, quartz: 3, stone: 10 }, quartzMax: 5, max: 6 };
export function upgradeCost(lvl): Inventory;      // < 3 pearls, < 5 quartz, else costTop
export const CAPA = { …, costTop: { thorn: 4, amber: 2 }, amberMax: 3, max: 4 };
export function capaCost(lvl): Inventory;         // < 3 cost, else costTop
// sim/rayo.ts
export const RAYO = { hp: 60, fly: 6, speed: 9, sight: 20, every: 3, tell: 0.8, dive: 18, diveMax: 1.4, climb: 6, damage: 10, reach: 1.6, grounded: 3, low: 2.5 } as const;
/** Hover over the nearest living player within sight; every 3 s: tell 0.8 s (anim 'attack'), dive at where they were, bite on contact, climb. Grounded: sits on the ground. Returns the bitten name. */
export function stepRayo(w: Wolf, targets: WolfTarget[], terrain: Terrain, dt: number, rng: () => number): string | null;
export function rayoLow(w: Wolf, ground: number): boolean;   // y − ground ≤ RAYO.low (melee can reach)
// Wolf gains optional dive?: 'tell' | 'dive' | 'climb'; diveT?: number; diveX?: number; diveZ?: number; grounded?: number.
// corrupt-lands.ts
export const ASH = { beasts: 6, brutes: 1, rayosMin: 2, rayosMax: 4, rayoCap: 8, dMin: 85, dMax: 165, rayoDrop: 0.5 } as const;
export function thornDrop(kind: EnemyKind, x: number, z: number, roll: number): number;  // 1 for wolf/brute in inCorrupt; rayo 1 if roll < 0.5; else 0
export function cenizaFogata(t: Terrain): { x: number; z: number; y: number };           // la Ceniza, d = 50, x = 24
// fogatas.ts: FOGATA.count 7, FOGATA.ceniza = 6; generateFogatas appends { id: 6, ceniza: true }.
```
- [ ] **Step 1: failing tests.** `upgradeCost(2)` pearls, `(3)`/`(4)` quartz, `(5)` = costTop; `weaponMult(6) = 1.9`, `weaponMult(9) = 1.9`. `capaCost(2)` = cost, `(3)` = costTop; `capaMult(4) = 0.6`. `ITEM_LABELS.thorn` built from `NAMES.thorn`. `stepRayo`: without targets it stays at ground + 6 ± 0.5; with a player 10 m away it closes in at altitude, flags `'attack'` for 0.8 s, then dives and bites once (returns the name) and climbs back to ≥ ground + 5 within 2 s; a grounded rayo does not move for 3 s and sits at ground; `rayoLow` true while grounded. `thornDrop`: wolf in the Espinar 1, wolf in the forest 0, rayo with roll 0.3 → 1, 0.7 → 0. `cenizaFogata` is inside la Ceniza (d 20–80) on dry, gentle ground. `generateFogatas` has 7 entries, id 6 at the Ceniza. `decodeClient` accepts `travel`/`fogata` with 6, rejects 7. `PROTOCOL_VERSION` 45 (intentional bump).
- [ ] **Step 2: implement** per interfaces. `ENEMY.rayo = { hp: 60, run: 9, damage: 10, reach: 1.6, biteCooldown: 3 }`, `ENEMY_LABELS.rayo = 'un ' + NAMES.flier`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): espinas negras, arma 6, Capa 4, el rayo marchito y la fogata de la Ceniza (protocolo v45)`.

### Task 2: Server — rayos and ash beasts in the Espinar, espina drops, the last upgrades

**Files:** Modify `src/shared/sim/world-sim.ts`; Create `src/shared/sim/world-sim-s5b.test.ts`.

- [ ] **Step 1: failing tests.**
  - With `fogOpen`, by day, a player in la Ceniza → after one step there are 6 ash beasts (1 brute) and 2–4 rayos in the Espinar band; a second step the same day spawns nothing more; with the fog closed nothing spawns; the next day (after dawn clears) they spawn again; rayos alive never exceed 8.
  - A rayo steps with `stepRayo` and its bite hurts the player (10 × Capa).
  - Punching a rayo 6 m up: no damage, hint "Vuela alto. Flechas, o viento"; punching a grounded one works. An arrow hits a flying rayo. A gust at it grounds it (`grounded` 3) and scratches it.
  - Killing a wolf in the Espinar gives the killer 1 espina; a wolf in the forest gives none; a rayo gives 1 or 0 by the rng.
  - Upgrade at the Heart from 5 with 6 espinas + 3 cuarzo + 10 piedra → 6, message "+90 %"; at 6: "El arma ya no da más de sí". Capa from 3 with 4 espinas + 2 ámbar → 4; at 4 refused.
- [ ] **Step 2: implement.** `spawnAsh()` from `step` when `!night && fogOpen && day !== ashDay` and a live player is in `inCorrupt`: sets `ashDay`; places `ASH.beasts` (first `brutes` as brutes) and `rayosMin..rayosMax` rayos at random `x ∈ (−HALF+20, HALF−20)`, `d ∈ [dMin, dMax]` outside the plateau. The wolf loop routes `kind === 'rayo'` (non-raid) to `stepRayo`. `onAttack`: a rayo not `rayoLow` → hint, no hit. `gustEnemies`: a rayo gets `grounded = RAYO.grounded`, `y` = ground, then the usual scratch. `strike`: on a kill, `thornDrop(...)` espinas to the killer (toast "+1 espina negra"). `onUpgrade`/`onCapa` use `upgradeCost`/`capaCost`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): rayos marchitos y bestias de ceniza en el Espinar; espinas negras para el arma 6 y la Capa 4`.

### Task 3: Server — la Ceniza fogata calls your deer, frog or fish (protocol v46)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/corrupt-lands.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `corrupt-lands.test.ts`, `world-sim-s5b.test.ts`.

**Interfaces:**
```ts
export type CallBeast = 'deer' | 'frog' | 'fish';
// ClientMsg: | { t: 'call'; beast: CallBeast }
export function callSpot(beast: CallBeast, fogata: { x: number; z: number }, lake: { x: number; z: number; r: number }): { x: number; z: number };
// deer 3 m west of the ring, frog 3 m north; fish at the Lago Negro's centre.
export const callText: Record<CallBeast, string>; // 'Silbas. Tu ciervo llega trotando' …
```
- [ ] **Step 1: failing tests.** `decodeClient` accepts the three beasts, rejects others. Server: at lit fogata 6 with a tamed deer parked in the forest → `p.steed` moves to the call spot and the toast arrives; unlit → "Esa fogata sigue apagada"; too far → nothing; no frog → "No tienes rana"; riding the deer → refused; in a dungeon → nothing. The fish goes to the lake's centre. `PROTOCOL_VERSION` 46.
- [ ] **Step 2: implement** `onCall(p, l, beast)`.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): en la fogata de la Ceniza se llama al ciervo, la rana o el pez (protocolo v46)`.

### Task 4: Client — rayos, espinas, the last upgrades and the Ceniza Menú

**Files:** Modify `src/client/game.ts`, `src/client/hud.ts`, `src/client/coast-ui.ts`, `src/client/swamp-ui.ts`; Tests `coast-ui.test.ts`, `swamp-ui.test.ts`.

**Interfaces:**
```ts
// coast-ui: coastAction uses inv + upgradeCost(weapon); label lists that cost ("Mejorar el arma (6 espinas negras, 3 cuarzo, 10 piedra)").
// swamp-ui: swampAction uses inv + capaCost(capa); fogataCalls(pos, spots, lit, owned): CallBeast[] (only at lit fogata 6).
```
- [ ] **Step 1: failing tests.** Upgrade label at 5 with espinas; none at 6. Capa label at 3 with espinas + ámbar; none at 4. `fogataCalls` returns the owned beasts only within reach of lit fogata 6; `[]` elsewhere or unlit.
- [ ] **Step 2: implement.** Rayo: `PaperActor('/enemies/enemy11.png', 2, …, 460/485)`, tint `0xb48ad8`, `0xffffff` while anim `'attack'` (the tell), pale yellow while grounded (anim idle at ground). Menú: "Llamar al ciervo / a la rana / al pez" buttons. Menú travel label for id 6: "Ir a la Ceniza". Inventory shows espinas (via `ITEM_LABELS`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de los rayos, las espinas y la fogata de la Ceniza`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 5 · S5-B" to `docs/superpowers/HANDOFF-aventura.md` (commits, tests, decisions, qué probar); one short comment on PR #3. No merge, no deploy.
