# Aventura — Slice 2 · S2-G: El Antenón y el defensor del viento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The coast boss fills the empty room S2-F left behind gate 3. **El Antenón** (`public/enemies/enemy3.png`, a paper cutout like the Tragón) has **360 PV** and a **"Cáscara de marea"**: blows, arrows and gusts do nothing until it is **exposed**. It is exposed **5 s** when a gust **pushes it into one of 4 coral pillars**, or **3 s after a parry**. Two telegraphed attacks: a **charge** (1.0 s windup, then a straight dash: 14 damage) and an **antenna sweep** (0.8 s windup, 10 damage within 4 m; roll to dodge). An empty room resets it. Beating it: `SavedWorld.purified2 = true`, **zone 6 (the coast Raíz-madre) is cleansed** (so `coastRaidBrutes` drops to 0: no more "algo sube de la costa"), and a **vision** names the players present. From then on a **small white Antenón** waits by the Heart and, **every 8 s, gusts the raiders within 12 m of the Heart 6 m away** (stunned 1 s; spikes and nets do the rest), next to the purified Tragón.

**Architecture:** A new pure module `src/shared/sim/antenon.ts` (`ANTENON`, `createAntenon`, `stepAntenon`, `pushAntenon`, `ANTENON_ALLY`, `stepGustAlly`), like `boss.ts`/`ally.ts`. The pillars live in `COAST_DUNGEON.pillars` and `clampCoast` keeps feet out of them. `WorldSim` gets `boss2` (live-only), `purified2` (saved) and `ally2` (live-only, rebuilt from `purified2`), mirroring the Tragón's `boss`/`purified`/`ally`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §6.4 (the boss cleanses zone 6 and ends the coast pressure), §7.3 (the boss), §11.2, §12 (row S2-G). "Decisiones de Gabriel": boss = `enemy3.png`, "El Antenón" (`NAMES.bossCoast`).

## Asset check (done while planning)

`public/enemies/enemy3.png` is 512 × 353 RGBA with **real transparency**: 125 044 of 180 736 pixels (69 %) have alpha 0, the corner pixel is `0,0,0,0`, and only 144 visible pixels are near-white. No keying is needed; it goes through `PaperActor` like `enemy1.png` (aspect 512/353).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`bossCoast`, `coastRoot`, `powerWind`, `bossForestShort`, `heart`).
- **Phones first. No new keys or pills.** The fight uses what exists: attack, bow, parry (🛡️), roll, and the Viento gust (power pill).
- **Trust boundary:** no new client message. The server decides the slam, the armour, the attacks and the defender.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 19 → 20: `EnemyKind` gains `'boss2'`, `CoastDungeonView.boss`, `snap.ally2`. New saved field `SavedWorld.purified2?` only: old saves load.
- **[D] Pillars:** 4 coral pillars (radius 1 m) at interior-relative (±5, 160) and (±5, 172), inside the 24 × 30 m room (the arena is the room: `z` 150–180). Players and the boss cannot stand in them.
- **[D] "Pushed into a pillar":** the boss's gust push (2 m, like every boss) moves it in 0.25 m steps; if a step would bring its body (1.3 m) into a pillar, it stops there and is **slammed**: exposed 5 s and stunned 1 s ("¡Contra el coral! La cáscara se abre"). A gust elsewhere only moves it.
- **[D] Attack choice:** target within 4 m and the sweep ready (3.5 s cooldown) → sweep; target 5–14 m and the charge ready (5 s cooldown) → charge (dash 12 m/s up to 0.8 s, stops at pillars and walls; each player hit once); otherwise it walks (2.6 m/s). A player standing next to it takes 10 every ~4.3 s: **~43 s** from 100 PV (target ≥ 30 s, like the Tragón after the Cierre).
- **[D] Gust while armoured:** the push and the slam work; the 5-damage scratch lands only once exposed (like the Tragón's paper).
- **[D] Defender:** every 8 s, if any raider is within 12 m of the Heart, the white Antenón pushes **all** of them 6 m away from the Heart (stun 1 s). No damage of its own; no water kills (keeps the cap question out). It has no HP, cannot die, stands 2.5 m on the Heart's other side from the Tragón.
- **[D] The "Algo duerme bajo la marea" message goes:** the room now wakes the boss. The S2-F test for that line is updated to the new rule (not deleted).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the session's attribution lines. Push after each task.

## File Structure

- Create `src/shared/sim/antenon.ts`, `src/shared/sim/antenon.test.ts`.
- Modify `src/shared/coast-dungeon.ts` (+ test): `pillars`, `pillarR`, pillar collision in `clampCoast`.
- Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.boss2`, label), `src/shared/sim/world-sim.ts` (+ test).
- Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/dungeon.ts` (pillars).

## Tasks

### Task 1: The rules (pure)

**Files:** Create `src/shared/sim/antenon.ts` + test; Modify `src/shared/coast-dungeon.ts` (+ test), `src/shared/protocol.ts` (`EnemyKind`), `src/shared/sim/wolves.ts`.

- [ ] **Step 1: failing tests.** `clampCoast` stops a walk into a pillar. `pushAntenon` 2 m toward a pillar 3 m away → slammed, stops at contact; 2 m into open floor → moved 2 m, not slammed. `stepAntenon`: a target 2 m away → sweep windup 0.8 s, then everyone within 4 m is hit (10), someone at 6 m is not; a target 9 m away → charge windup 1.0 s, then a dash that hits the target (14) once; stunned → no attack; stays inside the room box. **Balance:** a player standing still next to it takes ≤ 100 damage in 30 s.
- [ ] **Step 2: implement** (`ANTENON`, `Antenon extends Wolf { exposed, windup, move: 'sweep'|'charge'|null, dash, dirX, dirZ, sweepReady, chargeReady, hit: Set<string> }`, `createAntenon`, `stepAntenon(a, targets, dt) → { name, dmg }[]`, `pushAntenon(a, dir, dist) → slammed`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de El Antenón`.

### Task 2: The fight on the server (protocol v20)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** Someone alive in the coast boss room → the Antenón wakes ("despierta"). A punch while armoured → no HP lost ("La cáscara de marea aguanta…"). A gust pushing it into a pillar → exposed; a punch lands. A parry of its sweep → exposed 3 s. Leaving the room → it resets. At 0 HP: `purified2`, zone 6 cleansed, `coastRaidBrutes` = 0, a `vision` naming the players; it does not come back. Old save loads without `purified2`; `save()` writes it once true. Protocol v20.
- [ ] **Step 2: implement** (`boss2`, `purified2`, `stepAntenonFight`, `enemy()`/`strike()`/`bite()`/`gustEnemies()` branches, `dungeonView().coast.boss`, snapshot entry, `VISION.purified2`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): El Antenón en la sala de la Costa (protocolo v20)`.

### Task 3: The purified defender

**Files:** Modify `src/shared/sim/antenon.ts` (+ test), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** `stepGustAlly`: raiders within 12 m of the Heart are pushed 6 m outward and stunned when the 8 s clock is ready; one at 15 m is untouched; not before 8 s. World: with `purified2` and a Heart, `snap.ally2` exists; a raider next to the Heart gets pushed; without `purified2`, no `ally2`.
- [ ] **Step 2: implement** (`ANTENON_ALLY`, `GustAlly`, `createGustAlly`, `stepGustAlly`; `WorldSim.stepAlly2`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el Antenón blanco sopla a los asaltantes`.

### Task 4: Client

**Files:** Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/dungeon.ts`.

- [ ] **Step 1: failing tests.** `antenonBarText`: `El Antenón 360/360 · cáscara`, `· ¡expuesto!`, `· ¡barrido!` / `· ¡carga!` during windups; null without a boss.
- [ ] **Step 2: implement.** `PaperActor('/enemies/enemy3.png', 4, camera, 512/353)` for `boss2`, pale gold tint while exposed; a red ground ring (4 m) during the sweep windup and a red strip ahead during the charge windup; the four pink coral pillars in the coast interior; the white Antenón (`PaperActor`, 1.6 m, pale tint) by the Heart with a white flash when it gusts; the boss bar.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de El Antenón`.

### Task 5: Ship

- [ ] Append "## Slice 2 · S2-G — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/slice-1`, one short comment on PR #2.
