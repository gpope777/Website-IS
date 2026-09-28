# Aventura — Slice 3 · S3-F: El Zancudo, el farol y el nudo del Zarzal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The swamp boss fills the quiet room S3-E left behind gate 3 ("Algo zumba en la oscuridad. Aún duerme"). **El Zancudo** (`public/enemies/enemy9.png`, a paper cutout like the Tragón and the Antenón) has **380 PV** and **hovers 4 m up**: punches can't reach it ("Vuela alto…"), arrows, gusts and flames do **50 %**. It drifts between **4 gas vents**, moving to the next one every **6 s**; a **Llamarada on the vent under it** ignites the gas and it **falls for 5 s** (grounded: full damage, no attacks). A **parry of its dive** grounds it **3 s**. It **dives** (1.0 s shadow telegraph on the floor, 14 damage; roll to dodge) and a dive that lands **latches on** (**picadura**: 5 PV/s until you roll, max 3 s). An empty room resets it. Beating it: `SavedWorld.purified3 = true`, **zone 10 (Raíz-madre del Pantano) is cleansed** (so La Gata Araña stops leading raids: `gataLeads` already reads zone 10), and a **vision** names the players present. From then on a **white Zancudo hangs a farol by the Heart**: at night, every **10 s**, every **wolf** within **12 m** of the Heart **flees 3 s** (brutes, elites and the lieutenant ignore it; no HP, can't die; Heart HP and raid size untouched). Separately, the **Zarzal knot** on the forest's west rim burns to **3 Llamaradas** (≤5 m): `SavedWorld.zarzalBurnt = true` and a 10 m gap in the Zarzal stops biting and slowing **for everyone**, for good.

**Architecture:** A new pure module `src/shared/sim/zancudo.ts` (`ZANCUDO`, `createZancudo`, `stepZancudo`, `groundZancudo`, `FAROL`, `createFarol`, `stepFarol`), like `antenon.ts`. Vents live in `SWAMP_DUNGEON.vents`. The knot lives in `src/shared/swamp.ts` (`ZARZAL_KNOT`, `zarzalAt(t, x, z, burnt = false)` skips the gap once burnt). `WorldSim` gets `boss3` (live-only), `purified3` (saved), `ally3` (live-only, rebuilt from `purified3`), `zarzalBurnt` (saved) and `knotBurns` (live-only), mirroring `boss2`/`purified2`/`ally2`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §3.2 (burnt path), §7 (beating El Zancudo cleans zone 10), §8 (the Gata stops), §10.3 (the boss and the white defender), §15 (row S3-F). Names: `NAMES.bossSwamp`, `swampRoot`, `swampGate`, `powerFire`, `heart`, `lieutenant1`.

## Asset check (done while planning)

`public/enemies/enemy9.png` — the spec checked it (RGBA, 81 % fully transparent pixels). Re-read at plan time for the aspect ratio (Task 4 uses `width/height`). No keying: it goes through `PaperActor`. The spec's risk note: thin lines read small at 4 m hover → drawn **6 m wide**.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES`.
- **Phones first. No new keys or pills.** The fight uses attack, bow, parry (🛡️), roll and the power pill (Fuego/Viento). The knot burns with the same Llamarada.
- **Trust boundary:** no new client message. The server decides hover, vents, dives, latch, the farol and the knot.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 29 → 30 once for the whole plan: `EnemyKind` + `'boss3'`, `SwampDungeonView.boss` + `vents`, `snap.ally3`, `snap.zarzalBurnt`. New saved fields `SavedWorld.purified3?`, `SavedWorld.zarzalBurnt?` only: old saves load.
- **[D] Arena:** the boss room is the existing z 150–180 (24 × 30 m, a bit bigger than the spec's 22 × 22). 4 vents at interior-relative (±5, 158) and (±5, 172), radius 1.2 m; "over a vent" = its body within 1.5 m of the vent centre.
- **[D] Airborne damage:** punches → 0 and a line ("Vuela alto. Flechas, o fuego al gas bajo él"); arrows, gusts and Llamaradas → 50 %. A gust doesn't push it (it's in the air).
- **[D] Dive/latch:** dive only while hovering, target ≤16 m, cooldown 8 s; the shadow is fixed at the target's spot when the windup starts; at the end it lands there and hits everyone within 1.8 m (14, through the normal `bite`: roll dodges, parry grounds it 3 s). The first one hit (not dodged/parried) is latched: 5 PV/s × Capa, ends on roll, death, 3 s, or the boss grounding. After the dive it climbs back and drifts on.
- **Balance:** a player standing still under it: dive 14 + latch 15 every 9 s → **~31 s** from 100 PV (target 30–45 s, Cierre S1).
- **[D] Farol:** "at night" = `isNight`; it touches only `kind === 'wolf'` (raiders or not), reusing `w.flee`/`w.fleeFrom` from S3-E. Stands 2.5 m on the Heart's +z side (away from the other two defenders).
- **[D] Knot:** fixed spot `x = −HALF + 8, z = 120` (forest side of the thorns, the rim closest to spawn), not seeded. Gap = `|z − 120| < 5` across the whole Zarzal band. Terrain height is unchanged (the rim is walkable; only the thorns gate). Burning needs `FUEGO.rootReach` (5 m) and 3 Llamaradas; the count is live-only (a restart resets partial burns). The knot vision is left to S3-G (swamp visions); here a `say` line.
- **[D] Client thorns:** the thorn bushes are scattered once at load, so the gap never gets bushes; until burnt a row of dark knot roots fills it (and the thorn tint stays; cosmetic).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the session's attribution lines. Push after each task.

## File Structure

- Create `src/shared/sim/zancudo.ts`, `src/shared/sim/zancudo.test.ts`.
- Modify `src/shared/swamp-dungeon.ts` (`vents`, `ventR`, `ventAt`), `src/shared/swamp.ts` (+ test: `ZARZAL_KNOT`, gap), `src/shared/protocol.ts` (+ test), `src/shared/sim/wolves.ts` (`ENEMY.boss3`, label), `src/shared/sim/marchito.ts` (`VISION.purified3`), `src/shared/sim/world-sim.ts` (+ test).
- Modify `src/client/game.ts`, `src/client/movement.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/swamp-dungeon.ts` (vents, dive shadow), `src/client/scene/terrain-mesh.ts` (gap), a knot mesh.

## Tasks

### Task 1: The rules (pure)

**Files:** Create `src/shared/sim/zancudo.ts` + test; Modify `src/shared/swamp-dungeon.ts`, `src/shared/swamp.ts` (+ test), `src/shared/protocol.ts` (`EnemyKind`), `src/shared/sim/wolves.ts`.

- [ ] **Step 1: failing tests.** `stepZancudo`: hovers at floor + 4; drifts to the next vent every 6 s (`overVent` true once there); a target 3 m away → dive windup 1.0 s with a fixed shadow, then everyone within 1.8 m of the shadow is hit (14) and one at 5 m is not; the hit list names who to latch; grounded → y = floor, no attack; grounded ends after its time and it rises. `groundZancudo(z, 5)` sets grounded. Latch drains 5/s and ends at 3 s. **Balance:** a player standing still under it takes ≤ 100 in 30 s (latch counted). `stepFarol`: at night, wolves within 12 m of the Heart get `flee` 3 s when the 10 s clock is ready; a brute or `lieut1` is untouched; one at 15 m is untouched; by day nothing. `zarzalAt(t, knot.x - 20, 120, true)` false, `(…, false)` true where there are thorns; `(…, 130, true)` unchanged.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de El Zancudo, el farol y el nudo del Zarzal`.

### Task 2: The fight on the server (protocol v30)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** Someone alive in the swamp boss room (gate 3 open) → "El Zancudo despierta"; the old "Aún duerme" test updated to the new rule. A punch while hovering → no HP lost and the line; an arrow → half damage. A Llamarada on the vent under it → grounded 5 s, a punch lands full; on a vent it's not over → no fall. A parried dive → grounded 3 s. A landed dive latches; a roll frees. Leaving the room resets it. At 0 HP: `purified3`, zone 10 cleansed, a `vision` naming players; it doesn't come back; `save()` writes `purified3`; an old save loads without it. Protocol v30.
- [ ] **Step 2: implement** (`boss3`, `purified3`, `stepZancudoFight`, `strike(…, ranged)`, `bite` returns whether it landed, `onRoll` frees, vents in `flameThings`, `dungeonView().swamp.boss/vents`, snapshot entry, `VISION.purified3`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): El Zancudo en la sala del Pantano (protocolo v30)`.

### Task 3: The farol and the Zarzal knot

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- [ ] **Step 1: failing tests.** With `purified3` and a Heart at night: `snap.ally3` exists and a wolf next to the Heart flees; without `purified3`, `ally3` null. Knot: two Llamaradas → "humea (2/3)", the third → `zarzalBurnt`, `snap.zarzalBurnt`, saved; afterwards a walker in the gap takes no thorn bite and moves at full speed; outside the gap the thorns still bite. Old save loads with `zarzalBurnt` false.
- [ ] **Step 2: implement** (`stepAlly3`, knot in `flameThings`, `zarzalAt(…, this.zarzalBurnt)` at both sim checks).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el farol del Zancudo blanco y el nudo del Zarzal`.

### Task 4: Client

**Files:** Modify `src/client/game.ts`, `src/client/movement.ts`, `src/client/dungeon-ui.ts` (+ test), `src/client/scene/swamp-dungeon.ts`, `src/client/scene/terrain-mesh.ts`.

- [ ] **Step 1: failing tests.** `zancudoBarText`: `El Zancudo 380/380 · en el aire`, `· ¡en el suelo!`, `· ¡picado!` during the windup; null without a boss.
- [ ] **Step 2: implement.** `PaperActor('/enemies/enemy9.png', …)` for `boss3` (6 m wide), gold tint while grounded; 4 vents (dark rings, orange flash when lit) and a dark shadow disc at the dive point during the windup (bright, unfogged); the white Zancudo (1.6 m, pale) with a lantern by the Heart; the knot mesh until burnt; `zarzalAt(…, burnt)` in movement; the bar.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de El Zancudo y del nudo`.

### Task 5: Ship

- [ ] Append "## Slice 3 · S3-F — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish, same style). Commit, `git push origin aventura/resto`, one short comment on PR #3.
