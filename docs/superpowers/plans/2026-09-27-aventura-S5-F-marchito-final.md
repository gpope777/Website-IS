# Aventura — Slice 5 · S5-F: El Marchito, jefe final en la Copa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La Copa that S5-E left empty ("La Copa está vacía. Arriba solo hay cielo", marker `// S5-F`) gets its fight. **El Marchito** (`enemy12.png`, 9 m paper) with real HP at last: **1 200 × (1 + 0,35 · (jugadores en la Copa − 1))**, fixed when the fight starts. **Phase 1 — Raíces (100 → 60 %):** roots ×0.1 until a **Llamarada** within 5 m sets them alight (2 s) → **8 s bare** (full damage) → the new roots are **green 24 s** (fire doesn't take). He **swipes** (18, 1 s tell, parry → 3 s stagger with full damage) and throws **root lines** (3 lines, one on each fighter, 1.2 s tell, 15; roll dodges). **Phase 2 — Los cuatro brotes (60 → 25 %):** he sinks (invulnerable) and 4 brotes rise on the diagonals, one per power: **Enredadera** (2 vines), **Viento** (3 gusts), **Fuego** (3 Llamaradas, the cocoon stays burnt), **Piedra** (a pillar on its plate). Open → **A held 1.5 s** pulls it (−8.75 % of his max); any hit or stepping away ruins the pull. **Rayos** harass: 1 alone, 2 with friends, one back 10 s after it falls. **Phase 3 — el Corazón Negro (25 → 0 %):** his body freezes and the core (`public/enemies/enemy8.png`, 2.5 m paper) **runs** at 7 m/s, leaves a **violet trail** (4 PV/s), and every **10 s** runs back to him to **heal 5 %/s until hit**. A **Piedra pillar in its path stops it 3 s** (full damage, arrows ×1.5); running, its legs turn blows aside (×0.1). At 0 → `SavedWorld.ending = true`, a vision naming the players, and the hand-off to S5-G (`// S5-G`). **Death:** the stair checkpoint (S5-E); the fight is kept while someone is alive in the Copa and resets when it empties.

**Architecture:** A new pure module `src/shared/sim/marchito-final.ts` (`FINAL`, `createFinal`, `finalMult`, `burnRoots`, `staggerFinal`, `hitFinal`, `castOnBrote`, `broteOpen`, `startPull`, `breakBrote`, `hitCore`, `stepFinal`), like `cucurucho.ts`. `WorldSim` gets `towerFinal` (live-only) and `ending` (saved), mirroring `boss4`/`purified4`. The brotes and the core are `Wolf` records (kinds `'brote'`, `'core'`) so they draw, lock and take hits like every other foe; the Copa's rayos are ordinary tower wolves (the tower branch of the wolf loop learns `stepRayo`).

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §11.3 (the boss), §11.2.6 (stair checkpoint), §10.1 (what the ending does: S5-G), §16.1 (ids 900_009–014), §16.2 (`EnemyKind` + `'boss5' | 'core' | 'brote'`, `ending?`), §16.4 ("Final boss too long solo"), §17 (row S5-F). Names: `NAMES.villain`, `blackHeart`, `villainTower`, `powerVine/Wind/Fire/Stone`.

**Resolves the `// S5-F` markers:** `world-sim.ts` (`stepTowerDungeon`'s empty Copa) and the `tower-dungeon.ts` header.

## Asset check (done while planning)

`public/enemies/enemy8.png`: RGBA 638 × 536, 61 % transparent (spec §11.3). Unused until now. Through `PaperActor`, **2.5 m tall**, aspect 638 / 536. El Marchito keeps `enemy12.png` (589 × 662) at **9 m**. The brotes reuse `enemy12.png` at 2 m tinted by power (no new art).

## Balance — the solo time budget (Decidido por Claude — revisar)

The spec asks ~8 min solo with weapon 5–6. With its HP (1 200) a weapon-5 player (a punch = 35) is much faster than that in a straight damage race, so the time has to come from the fight's windows, not from HP:

| Phase | What sets its length | Starting numbers | Budget (sim) |
|---|---|---|---|
| 1 Raíces | bare windows: 2 s catch + 8 s bare, then 24 s green; rooted ×0.1 | 480 PV to strip | ~2.3 min |
| 2 Brotes | casts on cooldowns (Enredadera 12 s × 2, Viento 6 s × 3, Fuego 5 s × 3, Piedra 1 pillar), walking, 1.5 s pulls, a rayo in your face | 4 × 8.75 % | ~1.5 min |
| 3 Corazón Negro | only a stopped core really bleeds (×0.1 running); a stop needs a pillar in its path; it heals when it gets home | 300 PV | ~2.8 min |

`marchito-final.test.ts` runs a **scripted solo player** against the pure rules: weapon 5; a punch lands every 3 s while free; an arrow every 2 s (40 % on a running core); rolls every swipe and line (1.5 s lost); walks 4.5 m/s and needs 3 s at each brote to read it; a rayo costs 6 s every 14 s in phase 2 (and ruins a pull in progress); powers on their real cooldowns; in phase 3 it waits by the body and gets a pillar right on one return in three, and reacts to a heal in 2 s. **Result ≈ 6.7 min** (test: 6–10 min for several seeds).

- **[D] Deviations from the spec's numbers, both toward its 8-minute target:** rooted damage **×0.1** (spec ×0.2: at ×0.2 the chip alone ends phase 1 in ~1.5 min); running core **×0.1** (spec only says it's weak to Piedra and arrows).
- **[D] Brote steps** (spec left open): 2 vines / 3 gusts / 3 Llamaradas / 1 pillar on the plate. Work comes undone if left: vines 30 s, gusts 15 s after the last cast; the cocoon stays burnt; the plate counts while weighed.
- **[D] Rayos in phase 2:** **1 alone, 2 with 2+ players** (spec: 2). Two rayos diving at a player standing still kill in ~23 s; one takes ~40 s.
- **Standing next to him (phase 1):** swipe 18 / 10 s + lines 15 / 15 s = 2.8 PV/s → **~36 s** from 100 PV without Capa (target ≥ 30 s; spec ~40 s). Phase 3's trail only burns if you stand in it.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES`.
- **Phones first. No new keys or pills.** The fight uses attack, bow, parry, roll and the power pill (all four powers). Pulling a brote is the **contextual A / E** ("Arrancar el brote"), a new dungeon act **28** (like acts 26–27).
- **Trust boundary:** the only new client message is `dungeon` act 28 (already decoded through `decodeClient`, max raised to 28). The server checks: alive, in the Copa, phase 2, within 3 m of an open unbroken brote, nobody else pulling it.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 51 → 52 once for the whole plan: `EnemyKind` + `'boss5' | 'core' | 'brote'`, `TowerDungeonView.final`, dungeon act 28. New saved field `SavedWorld.ending?` only: old saves load (fight unbeaten).
- **Ids:** boss 900_009, core 900_010, brotes 900_011–014 (spec §16.1); the unique-ids test includes them.
- **[D] Arena:** the Copa disc (centre `(TOWER_DUNGEON.x, 222)`, r 22). He stands at the centre (no body collision: you can stand in his roots). The brotes sit 16 m out on the diagonals (Enredadera SW, Viento NW, Fuego NE, Piedra SE; its plate 3 m toward the centre).
- **[D] Waking:** the first living player in the Copa wakes him; the player count (factor) is those alive in the Copa at that moment. "La Copa está vacía…" goes away.
- **[D] Llamarada "≤ 5 m":** from the player to the edge of his body (body 2.5 m). A green-roots Llamarada says "Las raíces nuevas están verdes. Aún no prenden".
- **[D] Lines:** from his body out to 20 m; a 1 m half-width; one along each fighter's bearing (up to 3), the rest random. Roll dodges; a parry blocks the damage but doesn't stagger him.
- **[D] Pull:** A starts it; it finishes 1.5 s later if you stay within 3 m and nothing hurt you. Hits during a pull (a rayo) cancel it: "Se te escapa el brote".
- **[D] Core:** flees from the nearest fighter, slides along the Copa wall (19 m from the centre); each pillar stops it once. "Until hit": any blow (even ×0.1) stops a heal. Arrows count as arrows (×1.5 when stopped); a Llamarada's 6 counts as a blow.
- **[D] Reset:** when no living player is in the Copa (a solo death sends you to the stair, outside the Copa), the fight, the Copa rayos and the trail go; next time he wakes at full HP. (Spec: "reset if it empties".)
- **[D] Victory:** `ending = true` (saved), "El Corazón Negro se parte…" to all, a vision naming the players in the Copa, and `// S5-G` where the long vision, credits, white tower and world changes go. After `ending` the Copa is calm ("La Copa está en calma. Abajo se ve todo el bosque").
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/sim/marchito-final.ts`, `src/shared/sim/marchito-final.test.ts`, `src/shared/sim/world-sim-s5f.test.ts`.
- Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY`/labels), `src/shared/sim/elite.test.ts` (ids), `src/shared/sim/marchito.ts` (`VISION.final`), `src/shared/sim/world-sim.ts` (+ version test), `src/shared/tower-dungeon.ts` (header).
- Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test).

## Tasks

### Task 1: The rules (pure) and the solo sim

**Files:** Create `src/shared/sim/marchito-final.ts` + test; Modify `src/shared/protocol.ts` (`EnemyKind` only), `src/shared/sim/wolves.ts`, `src/shared/sim/elite.test.ts`.

```ts
export const FINAL = { id: 900_009, coreId: 900_010, broteIds: [...], baseHp: 1200, perPlayer: 0.35, p2At: 0.6, p3At: 0.25, rootMult: 0.1, burnReach: 5, catchFor: 2, bareFor: 8, greenFor: 24,
  swipeEvery: 10, swipeTell: 1, swipeDamage: 18, staggerFor: 3, linesEvery: 15, linesTell: 1.2, lineDamage: 15, broteShare: 0.0875,
  need: { vine: 2, wind: 3, fire: 3, stone: 1 }, hold: { vine: 30, wind: 15, ... }, pullFor: 1.5, pullReach: 3, rayos: [1, 2], rayoRespawn: 10,
  coreHp: 300, coreSpeed: 7, coreRunMult: 0.1, arrowMult: 1.5, trailDps: 4, returnEvery: 10, healRate: 0.05, stunFor: 3, pillarR: 2, ... };
export function createFinal(players: number): FinalBoss;
export function stepFinal(b, targets, pillars: {id;x;z}[], dt, rng): { hits: { name; dmg; kind: 'swipe' | 'line' | 'trail' }[]; events: (...)[] };
```
- [ ] **Step 1: failing tests.** 1 200 / 1 620 / 2 460 PV for 1 / 2 / 4 players. Rooted ×0.1; Llamarada far → 'far'; close → catch, bare after 2 s for 8 s, then green 24 s ('green'), then catches again. Parry stagger → full damage 3 s. Swipe (18) after a 1 s tell only within 5 m. Lines: one on a fighter, 15 after 1.2 s. At 60 % → phase 2 with four brotes (ids 900_011–014, powers in order), untouchable. **Standing still next to him: < 100 in 30 s, ≥ 100 by 45 s.** Brote casts (wrong power → null), open counts, pulls finish in 1.5 s (−8.75 %), walking away cancels; the 4th → phase 3, core 300. Work comes undone (vines 30 s, gusts 15 s), cocoon stays. Core runs ≤ 7 m/s, stays in 19 m, trail 4 PV/s; a pillar stops it 3 s once; running ×0.1, stopped ×1 and arrows ×1.5; returns and heals; a blow stops the heal; at 0 → won. **Sim:** scripted solo kill between 6 and 10 min (3 seeds). Unique ids include the six new ones.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de El Marchito final y simulación en solitario`.

### Task 2: Phase 1 in the Copa (protocol v52)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ version test), `src/shared/tower-dungeon.ts`, `src/client/dungeon-ui.ts` (empty view only); Test `world-sim-s5f.test.ts`.

```ts
// PROTOCOL_VERSION 52
export interface FinalView { phase: 1 | 2 | 3; hp: number; max: number; bare: boolean; catching: boolean; green: boolean; swipe: boolean;
  lines: { x0: number; z0: number; x1: number; z1: number }[]; brotes: { power: 'vine' | 'wind' | 'fire' | 'stone'; open: boolean; broken: boolean; steps: number; need: number }[];
  pull: number | null; core: { hp: number; max: number; stopped: boolean; healing: boolean } | null; trail: { x: number; z: number }[] }
TowerDungeonView.final: FinalView | null
```
- [ ] **Step 1: failing tests.** Someone alive walks into the Copa → "El Marchito baja a la Copa…" and `snap.dungeon.tower.final.max` = 1 200 (two players in the Copa: 1 620); "La Copa está vacía" no longer said. A punch while rooted does 10 % (weapon 0: 2); a Llamarada within 5 m → 2 s later bare, a punch does 20. His swipe hurts a player within 5 m after the tell; a parry staggers him. Lines hurt a player standing on one. Everyone out of the Copa (or dead) → reset: next entry full HP. The wolves list carries `boss5`. `decodeClient` takes act 28, refuses 29. Protocol 52.
- [ ] **Step 2: implement** (`towerFinal`, `stepTowerFinal` in the step after `stepTowerFlecha`, `enemy()` + `strike()` + parry in `bite()`, the Llamarada hook, snapshot entry, `towerView().final`, resolve the `// S5-F` markers).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): El Marchito despierta en la Copa (protocolo v52)`.

### Task 3: Phases 2 and 3, victory and the checkpoint

**Files:** Modify `src/shared/sim/world-sim.ts`, `src/shared/sim/marchito.ts` (`VISION.final`); Test `world-sim-s5f.test.ts`.
- [ ] **Step 1: failing tests.** At 60 % the brotes rise ("Se hunde…"), he takes no damage. Two vines near the Enredadera brote, three gusts at the Viento one, three Llamaradas at the Fuego one, a pillar on the plate: each opens (toasts "(n/need)"). Act 28 within 3 m of an open brote → after 1.5 s it's gone and his HP drops 8.75 %; a closed one says what it wants; a hit during the pull cancels it. One rayo in the Copa alone (two with two players), back 10 s after it dies; they stay inside. The 4th brote → phase 3: the core runs; a pillar in its path stops it; an arrow on a stopped core does ×1.5; standing on its trail hurts. Core at 0 → `ending` true, a `vision` with the names, `save().ending`, the fight doesn't come back and the Copa is calm. Dying in the Copa → the stair; the Copa empties → the fight resets. Old saves load without `ending`.
- [ ] **Step 2: implement** (brote hooks in `onPower` / `onGust` / flames / pillars, act 28, Copa rayos in the tower branch with `stepRayo`, core hits in `strike`, trail damage, `ending` save/load, `// S5-G`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): los brotes, el Corazón Negro y la victoria`.

### Task 4: Client

**Files:** Modify `src/client/dungeon-ui.ts` (+ test), `src/client/game.ts`.
- [ ] **Step 1: failing tests** (`dungeon-ui.test.ts`): `finalBarText`: "El Marchito 900/1200 · raíces" / "· ¡arde!" / "· raíces verdes" / "· ¡se tambalea!"; phase 2 "El Marchito se hunde · brotes 1/4"; phase 3 "El Corazón Negro 200/300 · ¡parado!" / "· ¡se cura!". `towerDungeonAction` with a final view offers "Arrancar el brote" (act 28) within 3 m of an open brote, "El brote pide Viento (1/3)" as a label-only hint is not an act (null) — the server says it on A.
- [ ] **Step 2: implement:** PaperActors for `boss5` (enemy12, 9 m, tint: rooted dark violet, burning orange, bare pale, green greenish), `core` (enemy8, 2.5 m), `brote` (enemy12, 2 m, tinted by power; brighter when open); three red root-line boxes during the tell (like La Flecha's line); a pool of 16 violet discs for the trail; the bar; contextual A.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de El Marchito final`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 5 · S5-F" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. Never merge.
