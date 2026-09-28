# Pulido · P7-F: Tutorial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-F of the spec's plan map (§14), spec §8 — the last plan of #7 and of the roadmap. A new player on a phone learns by **doing**, in ~10 minutes, in the shared world (no separate zone): 8 short steps, one line each in the tracker's place plus a pulsing ring on the real control. The state lives **on the server, per player** (`SavedPlayer.tut`), so it follows the player between phone and PC. A **practice wolf** (step 6–7) belongs to one learner: it only chases and bites its owner, only its owner can hurt it, and it gives no Savia, no Libro kill and no drop. **Saltar tutorial** is always visible top right; **Repetir tutorial** lives in Menú › Ayuda. Anyone with existing progress never sees it. At the end the P7-D "Qué sigue" line takes over.

**Architecture:** pure and tested: `src/shared/tutorial.ts` (steps, the per-step state machine `tutAdvance`, `hasProgress`, `tutPills`, lines). Server: `world-sim.ts` feeds events into it (move, eat, harvest, build, Heart near, parry / dodge / bitten by the practice wolf, kill, bow), keeps `tutWolves` apart from `this.wolves`, and reports `self.tut` and `PlayerView.tut`. Client: `src/client/tutorial-ui.ts` (pure: what the line says, co-op notes, which pill glows) wired in `game.ts` / `hud.ts` / `touch.ts`.

**Tech Stack:** TypeScript, DOM/CSS, Vite, Vitest 4, Playwright (screenshots only).

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §5.1 (pills), §8 (tutorial), §12 (checklist), §13 (risks), §14 (P7-F).

## Global Constraints

- **Protocol 64 → 65** (P7-D already took 64; noted in its HANDOFF). New fields are optional: `SavedPlayer.tut`, `SelfState.tut`, `PlayerView.tut`, client msg `{ t: 'tut', act: 'skip' | 'repeat' }`. Old saves load. Tests pinning 64 move to 65 (intended). No test deleted or weakened.
- **No rule, balance or timing change for anyone not in the tutorial.** The practice wolf is outside `this.wolves`: raids, allies, traps, powers, dawn cleanup and Savia never see it.
- **Touch grid ≤ 10**: no new pill. "Saltar tutorial" is a small DOM button in the HUD (top right, under the system buttons), not a pill.
- Spanish player-facing text, dry voice, no "!". `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Who sees it:** on load (constructor) and on connect, a player with `tut` absent gets `'skip'` if they have **any** progress — own Heart, an orb, Savia > 0, a power, a mount, oficios, kills, a structure they own, or anything in the mochila (stricter than the spec's list: "quien ya jugó nunca lo ve"). A new record (`createPlayer`) starts at step 1. `tut` is `1..8 | 'done' | 'skip'`.
- **[D] The 8 steps and what advances them (server events):**
  1. **Mirar y andar** — 10 m walked + 90° turned (from accepted `move`s).
  2. **Coger y comer** — eat one berry (`eat` with berries; bushes give 2).
  3. **Talar y picar** — the mochila holds the fogata's cost (**5 madera, 3 piedra**; the spec's "3 y 2" does not pay for a fogata). Mochila, not counters: what a friend hands you counts (§8.3).
  4. **Fuego** — build a fogata.
  5. **Corazón** — build the Heart (**20 madera, 10 piedra**), or — the world already has one (it is one per world) — walk to ≤ 15 m of it ("Este mundo ya tiene Corazón. Ve a verlo."). The "≤ 60 m of spawn" of the spec is a hint in the line, not a new build rule.
  6. **Pelear** — the practice wolf spawns 15 m away (by day, no raid). Done on **a parry, 2 dodges (a bite rolled through), 3 bites taken, or killing it**.
  7. **Arco y fijar** — any arrow that hits your practice wolf. If it died in step 6, a **still** practice wolf (does not move or bite: the "tocón con diana" of the spec without a new model) appears 12 m ahead.
  8. **Salir a explorar** — 30 m walked; then `tut: 'done'`, toast "Tutorial hecho.", the wolf goes, and the P7-D line ("✨ Santuario del Bosque …") is what shows. During step 8 the tutorial line says "¿Ves un haz de luz? Es un santuario. Anda hacia él."
- **[D] Waiting:** a raid (warn or active) pauses every step and the line says "Primero, aguanta."; night pauses only steps 6–7 (no practice wolf at night: the real ones are out). A new player arriving at night can still do 1–5 (otherwise they would stand still for a whole night).
- **[D] Practice wolf:** a `Wolf` with `kind: 'wolf'`, `tut: owner`, 40 PV, bites for 4, **never flees fire**, targets only its owner, **never kills** (a bite leaves at least 10 health). Only its owner's snapshot shows it; others' attacks, arrows and powers do nothing to it. Its kill gives no Savia, no Libro count, no thorns, no "X derrotó" broadcast. It is removed on skip, done, away, or when the owner is > 60 m from it (respawned next tick if the step still wants it).
- **[D] Skip / Repeat:** `{ t: 'tut', act: 'skip' }` → `'skip'` (wolf gone). `repeat` → step 1 with fresh counters (anything already true, like the Heart nearby, passes on its own when reached). Repeat is in **Menú › Ayuda** (a button under the cards); the spec's Ajustes row is not added (one place is enough).
- **[D] Co-op (§8.3):** `PlayerView.tut = step` for a learner. A non-learner within 30 m sees " · Leo está aprendiendo (4/8)" after their own goal line; the learner sees " · (Bea puede ayudarte)". Steps count only the learner's own actions (the mochila rule of step 3 lets a friend's gift count). Two learners: each their own step and wolf.
- **[D] Pills while learning:** `tutPills(step, heart)` replaces the P7-C rule: 🫐 from step 2, 🔥 from 4, 🌳 at 5 (if no Heart), 🌀 🛡️ from 6, 🏹 🎯 from 7; 🧱 🗡️ 🌿 only after the tutorial (then the normal rule). The step's control glows (`.hint` ring): A for 1–3 until the pill exists, 🫐, 🔥, 🌳, 🌀+🛡️, 🎯+🏹. On PC the line names the key instead.
- **[D] Tips:** P7-D tips are held back while learning; on `done` the tips the tutorial already taught (look, berries, wood, wolf, roll, bow) are marked shown.

## File Structure

- Create `src/shared/tutorial.ts` (+`tutorial.test.ts`).
- Modify `src/shared/protocol.ts` (65, `tut` fields and message), `src/shared/protocol.test.ts`, `src/shared/sim/wolves.ts` (`Wolf.tut?`), `src/shared/sim/world-sim.ts`; create `src/shared/sim/world-sim-p7f.test.ts`; update tests pinning 64.
- Create `src/client/tutorial-ui.ts` (+test); modify `src/client/game.ts`, `src/client/guide-ui.ts`, `src/client/hud.ts`, `src/client/touch.ts`, `src/client/menu-ui.ts`, `src/client/style.css`.

## Tasks

### Task 1: pure `tutorial.ts` — steps, state machine, exemption, pills

```ts
export const TUT = { steps: 8, walk: 10, turn: Math.PI / 2, heartNear: 15, wolfHp: 40, wolfDmg: 4, wolfAt: 15, stillAt: 12, floor: 10, dodges: 2, fails: 3, explore: 30, leash: 60, near: 30 } as const;
export type TutState = number | 'done' | 'skip';
export interface TutProgress { step: number; walk: number; turn: number; dodges: number; fails: number }
export type TutEvent = { k: 'move'; m: number; turn: number } | { k: 'eat' } | { k: 'inv'; inv: Inventory } | { k: 'build'; kind: StructureKind } | { k: 'heartNear' } | { k: 'parry' } | { k: 'dodge' } | { k: 'bitten' } | { k: 'kill' } | { k: 'bow' };
export function tutStart(step?: number): TutProgress;
export function tutAdvance(p: TutProgress, e: TutEvent): TutProgress;   // step 9 = done
export function hasProgress(p: ProgressLike, ownsHeart: boolean, ownsStructure: boolean, xp: number): boolean;
export function tutPills(step: number, heart: boolean): boolean[];     // PILLS order
export function tutLine(step: number, o: { touch: boolean; heart: boolean; inv: Inventory; wait: boolean }): string;
```

- [ ] **Step 1: failing tests.** Each step advances only on its own event (walking 10 m without turning stays at 1; turning without walking stays; eat at 2; inventory ≥ 5/3 at 3 — also when the inventory arrives by any path; a fogata at 4, a wall does not; Heart built or `heartNear` at 5; parry / 2 dodges / 3 bites / kill at 6; bow at 7; 30 m at 8 → 9). Events for other steps are ignored; counters reset on each new step. `hasProgress`: empty save false; each progress field alone true. `tutPills` by step (never more than the 10 slots; wall/trap/power never). `tutLine`: touch vs PC wording, "Primero, aguanta." when waiting, step 5 shows what you have vs the cost and the "already has a Heart" variant; no "!", ≤ 90 chars.
- [ ] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): tutorial.ts: los 8 pasos, su máquina de estados y quién lo ve`.

### Task 2: server — `tut`, events, the practice wolf, skip/repeat, protocol 65

- [ ] **Step 1: failing tests** (`world-sim-p7f.test.ts`): new player starts at 1 and `self.tut.step` is 1; a save with progress and no `tut` loads as `'skip'` and gets no `self.tut`; an empty old save without `tut` starts the tutorial; walk+turn → 2; harvest + eat → 3; 5/3 in the mochila → 4; fogata → 5; Heart → 6 (and the "already a Heart" path by walking close); by day a practice wolf appears ≤ 20 m away, only in the owner's snapshot, only bites the owner, never kills (floor 10); another player's attack/arrow does nothing to it; a parry → 7; killing it gives 0 Savia, 0 Libro kills, no thorns and no broadcast; step 7 with the wolf dead spawns a still one; an arrow → 8; 30 m → `'done'`, toast "Tutorial hecho.", wolf gone; raid pauses and reports `wait`; night holds step 6 without a wolf; skip at any step → `'skip'` + wolf gone; repeat → step 1; two learners have two wolves; `PlayerView.tut` for a learner, absent for others. Protocol: decode `tut` skip/repeat, reject others; pins → 65.
- [ ] **Step 2: implement.** `tutEvent(p, l, e)` helper applies `tutAdvance` and handles entering 6/7 (spawn), leaving (despawn), `done`. Hooks in `accept`, `onEat`, `onHarvest`/`gain` (inventory), `onPlace`, `bite` (parry / dodge / bitten), `strike` (tut branch first), `step()` (heart near, wolves, leash, waits), `markAway`, `connect` (migration), `createPlayer`.
- [ ] **Step 3:** green, commit `feat(pulido): tutorial en el servidor, lobo de práctica y protocolo 65`.

### Task 3: client — the line, Saltar, the glowing control, pills, co-op, Repetir; screenshots and perf

```ts
// tutorial-ui.ts (pure)
export function tutHud(o: { tut: { step: number; wait?: boolean } | null; touch: boolean; heart: boolean; inv: Inventory; me: {x:number;z:number}; players: { name: string; x: number; z: number; tut?: number }[] }): { line: string | null; hint: HintTarget[]; pills: boolean[] | null; note: string | null };
export const TAUGHT_TIPS: TipId[];
```

- [ ] **Step 1: failing tests** for `tutHud` (line per step, hint per step touch/PC, note "(Bea puede ayudarte)" / "Leo está aprendiendo (4/8)" within 30 m only, `pills` null after the tutorial) and `helpHtml` gaining the "Repetir tutorial" button.
- [ ] **Step 2: wire.** `game.ts`: each snapshot → `tutHud`; while learning, the goal line is the tutorial line (`guide-ui` gets an override), the P7-D tips are held, pills come from `tutPills`, `touch.setHint`, the skip button shows; on the step going to none after a number → mark `TAUGHT_TIPS` shown. `hud.ts`: `.tut-skip` button (safe-area, top right under MENÚ/🎒), `setTutNote`. `touch.ts`: `setHint(targets)` toggles `.hint` on A / pills. Menú › Ayuda: "Repetir tutorial" → `{ t: 'tut', act: 'repeat' }`.
- [ ] **Step 3: screenshots** (Playwright, 390×844 touch, a fresh player; steps forced by playing the real messages from a harness script where possible, otherwise by a dev-only `?tut=N` URL flag that only changes what the client *draws*): one per step 1–8 + a "Primero, aguanta." + Menú › Ayuda with Repetir. Describe honestly. **Perf:** `npm run perf -- --tier low` (< 10 min), equal to base.
- [ ] **Step 4:** green, commit `feat(pulido): tutorial en pantalla: línea, Saltar, control que brilla, pastillas y Repetir`.

### Task 4: HANDOFF — P7-F, "Pulido — resumen", "ESTADO DEL PROYECTO — leer primero"

- [ ] "## Pulido · P7-F — Tutorial …" (commits, tests, perf, Decidido por Claude — revisar, NO verificado, Qué probar).
- [ ] "## Pulido — resumen (LEER PRIMERO)" at the top of the Pulido area: P7-A..F one line each, the combined "Decidido por Claude — revisar", the not-verified list.
- [ ] Rewrite the top "Aventura completa — estado" paragraph into "## ESTADO DEL PROYECTO — leer primero": all subprojects done, PR #3 draft awaiting Gabriel, protocol 65, test counts, prioritized phone checks (from every resumen), the full §12 checklist, the drop-in asset pointer, rollback (revert the merge commit → redeploy).
- [ ] Commit `docs(pulido): handoff P7-F y estado del proyecto`.

### Task 5: Ship

- [ ] All four commands green; `git push origin aventura/resto`; one short comment on PR #3 (roadmap complete, protocol 65, where to start reading, the §12 list before merging).
