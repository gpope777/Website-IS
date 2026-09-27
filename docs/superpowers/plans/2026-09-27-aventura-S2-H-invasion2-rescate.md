# Aventura — Slice 2 · S2-H: Invasión 2 y el rescate del Tragón — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last Slice 2 story beat. At the **first dusk after anyone tames the fish** (with Invasion 1 done, the Tragón purified and a living Heart), **El Marchito comes up from the south**, walks to the white Tragón by the Heart and wraps it in roots for **6 s** (a "grab" bar). Then it is **gone**: no defender at night. His voluntad is Invasion 1's formula **×1.2**. **Driving him off early does not stop the theft**, but then he breaks **no** defenses; if he is not driven off he **wrecks the nearest quarter** of them as he leaves. Vision: «Me llevo al perrito de papel. Vengan a por él al mar, Ana.». **Rescue:** the Tragón hangs in a **root cage** on the seabed north of the dungeon island (outside the aguas bravas, so the fish reaches it). The cage is held by **3 anchors, one per islet**: withered roots with **150 PV** each; blows and arrows hurt them, a **Viento gust does ×3**. The first time someone reaches an islet whose anchor stands, **2 corrupt wolves** spawn there as guards. Each broken anchor snaps a purple chain and the cage sinks lower. With all 3 broken, **A at the cage** frees it: the Tragón goes home with **+10 bite** ("vuelve con rabia") and El Marchito sulks in a vision.

**Architecture:** A new pure module `src/shared/rescue.ts` (`RESCUE`, `rescueSite(terrain, seed)`: the cage spot and the 3 anchor spots, seeded, client and server agree). `src/shared/sim/marchito.ts` gains the thief: `stepThief`, `thiefWill`, `pickDefenses(…, frac)`, and the Invasion 2 lines in `VISION`. `WorldSim` gets `invasion2` (saved), `anchors` (saved broken flags; anchor hp is live-only), `anchorFoes` (live `Wolf` records of kind `'anchor'`, so attack, bow, lock and gust work unchanged) and `guarded` (live-only, per islet). The thief reuses `this.marchito` with a `grab` field.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-2-costa-design.md` §8 (Invasion 2), §11.2, §12 (row S2-H). "Decisiones de Gabriel": Invasion 2 takes the **purified Tragón**.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`villain`, `bossForestShort`, `heart`, `powerWind`).
- **Phones first. No new pill.** Freeing the cage is the contextual **A** ("A · Liberar al Tragón"). Anchors are hit with attack / bow / gust like any enemy (auto-aim and lock work because they travel in `snap.wolves`).
- **Trust boundary:** one new client message `{ t: 'rescue' }` through `decodeClient`; the server checks the state, the distance and that all anchors are broken.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 20 → 21 (`MarchitoView.grab?`), Task 3 bumps 21 → 22 (`EnemyKind` `'anchor'`, `snap.cage`, `rescue` message). New saved fields `SavedWorld.invasion2?` and `SavedWorld.anchors?` are optional: old saves load.
- **[D] Trigger:** checked every tick: `invasion2 === 'pending'`, `invasion === 'done'`, `purified`, a Heart with hp > 0, it is day with `dayFraction ≥ RAID.warnAt` (the raid-warning window, "dusk"), and someone alive outside the dungeons. `invasion2` becomes `'pending'` the moment any player tames a fish; **old saves where someone already owns a fish load as `'pending'`**. A fish tamed during the dusk window can trigger that same dusk (simplest; the spec's "first dusk after" is honoured in the usual case).
- **[D] Worlds that never purified the Tragón:** nothing happens; the invasion waits until every condition holds (it starts at the first dusk after the Tragón is purified and Invasion 1 is done). No cage, no anchors.
- **[D] Entry:** 28 m **south** (+z, toward the coast) of the Heart, clamped to the map. He walks to the Tragón (reach 2.6 m) and grabs for 6 s; the Tragón stands still (`anim 'idle'`) while wrapped. He still swipes players within 3 m (14).
- **[D] Drive-off:** at 0 voluntad he leaves **at once with the Tragón** (theft done, no wrecks, "driven" vision). Otherwise at the end of the grab: the theft, then the nearest **quarter** of the defenses (ceil) are wrecked in the same tick, a vision, and he is gone (no walk-away animation). Mid-grab save → still `'pending'`: he comes back at the next dusk window (like Invasion 1); anything wrecked stays wrecked.
- **[D] Cage spot:** on the seabed at `island.r + FISH.bravas + 6` m from the dungeon island's centre, the first of 12 angles (starting north, toward the beach) that is wet (depth ≥ 2 m) and ≥ `r + 6` m from every islet. Anchors: on each islet, `0.3 r` north of its centre (dry land).
- **[D] Anchors:** `Wolf` records `{ id: 910000 + i, kind: 'anchor', hp 150 }` that never move or bite; not stunned or pushed by gusts, just hurt ×3 (15). Partial anchor damage is live-only (a reload heals unbroken anchors; broken ones stay broken). Broken anchors are removed from `snap.wolves`.
- **[D] Guards:** 2 plain `'wolf'`s spawned on the islet's dry ground the first time (per load) an alive player comes within `r + 12` m of an islet whose anchor stands. They follow the normal wolf rules (and dawn clears them like any wolf).
- **[D] Rescue:** A within 5 m (horizontal) of the cage with all 3 anchors broken → `invasion2 = 'rescued'`, `anchors` dropped from the save, the Tragón is back by the Heart and bites for `ALLY.damage + ALLY.rage` (25 + 10).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the session's attribution lines. Push after each task.

## File Structure

- Create `src/shared/rescue.ts`, `src/shared/rescue.test.ts`, `src/client/scene/rescue.ts`.
- Modify `src/shared/sim/marchito.ts` (+ test), `src/shared/sim/ally.ts` (`ALLY.rage`), `src/shared/sim/wolves.ts` (`ENEMY.anchor`, label), `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ test).
- Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/coast-ui.ts` (+ test), `src/client/hud.ts` (Menú line).

## Tasks

### Task 1: The rules (pure)

**Files:** Create `src/shared/rescue.ts` + test; Modify `src/shared/sim/marchito.ts` (+ test).

- [ ] **Step 1: failing tests.** `rescueSite`: deterministic per seed; the cage is wet (depth ≥ 2), outside the aguas bravas (`> island.r + FISH.bravas`), clear of the islets; 3 anchors, each on dry land of its islet. `pickDefenses(structs, heart, 0.25)` → the nearest quarter (ceil), never the Heart. `thiefWill(n) = round(1.2 × marchitoWill(n))`. `stepThief`: walks to the goal, then grabs; returns `{ t: 'grabbed' }` after 6 s at reach; swipes a player within reach; stunned → no progress.
- [ ] **Step 2: implement** (`RESCUE = { anchorHp: 150, gustMult: 3, guards: 2, guardReach: 12, freeReach: 5, anchorIdBase: 910000 }`, `rescueSite`; `MARCHITO.grabFor = 6`, `Marchito.grab`, `stepThief`, `thiefWill`, `VISION.steal/stolen/driven2/rescued`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la Invasión 2 y del rescate`.

### Task 2: Invasion 2 on the server (protocol v21)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** A world with Invasion 1 done, purified, a Heart and walls: taming a fish sets `pending`; at dusk the Marchito appears south of the Heart with 1.2× will and a vision; after the grab the ally is gone, `invasion2 === 'taken'`, a quarter of the walls wrecked. Driven off mid-grab → theft, no wrecks. Not purified → nothing at dusk. Old save with a fish owner loads `pending`; save round-trips `invasion2`. `snap.marchito.grab` while grabbing. Protocol v21.
- [ ] **Step 2: implement** (`invasion2`, `stepInvasion2`, `startTheft`, `endTheft`, `wearMarchito` branch, ally gated on `invasion2 !== 'taken'` and frozen while wrapped, `MarchitoView.grab?`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): El Marchito se lleva al Tragón (protocolo v21)`.

### Task 3: The rescue on the server (protocol v22)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/wolves.ts`, `src/shared/sim/ally.ts`, `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** With `taken`: `snap.cage` lists 3 anchors at 150; the anchor appears in `snap.wolves` near it; punches hurt it; a gust does 15; at 0 it breaks (`anchors[i]`, "se parte una cadena", gone from wolves). Reaching an islet spawns 2 guard wolves once. `rescue` with anchors standing → refused; all broken and near the cage → `rescued`, ally back, bite 35, vision. Save round-trips `anchors`; old save loads. `decodeClient({t:'rescue'})`. Protocol v22.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): la jaula de raíces y el rescate (protocolo v22)`.

### Task 4: Client

**Files:** Create `src/client/scene/rescue.ts`; Modify `src/client/game.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/coast-ui.ts` (+ test), `src/client/hud.ts`.

- [ ] **Step 1: failing tests.** `marchitoBarText` shows `El Marchito envuelve al Tragón · 40 %` while grabbing. `rescueAction` → "Liberar al Tragón" near the cage with all anchors broken; "La jaula aguanta: quedan 2 anclas" with some standing; null far away or without a cage.
- [ ] **Step 2: implement.** `RescueMeshes`: the root cage (dark bars, the pale Tragón paper inside) on the seabed, sinking 1.5 m per broken anchor; each standing anchor a withered root with a violet glow and a purple chain rising toward the sky; broken ones hidden. Anchors skipped in the wolf-actor loop (they still feed auto-aim). Contextual A sends `rescue`. A Menú line.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del rescate`.

### Task 5: Ship

- [ ] Append "## Slice 2 · S2-H — …" and the **Slice 2 — resumen** to `docs/superpowers/HANDOFF-aventura.md` (Spanish). Commit, `git push origin aventura/slice-1`, one short comment on PR #2.
