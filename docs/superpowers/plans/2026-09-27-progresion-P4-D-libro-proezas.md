# Progresión · P4-D: Libro y Proezas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the last plan of subproject #4 (spec §6, §7, row P4-D of §11). Cheap per-player **counters** (bosses beaten, kills, raids held), the **6 Proezas** checked by the server where the thing already happens, their **3 hats** (Papel doblado, Gorro de nieve, Corona marchita), and the **Libro** page in the Menú: Rango + Savia bar, equipment, powers, mounts, counters, Proezas, and buttons to Oficios and Aspecto.

**Architecture:** pure `FEATS`, `BOSS_KINDS`, `bossesOf`, the 3 extra hats in `HAT_IDS` (7–9) and `hatUnlocked` reading `feats` in `src/shared/progression.ts`. `WorldSim` keeps the counters on `SavedPlayer` (`bosses?`, `kills?`, `raidsHeld?`, `feats?`, all optional) and a few live-only flags for the Proeza checks; it sends `SelfState.book` (counters + feats + world zones/day). The Libro is pure HTML from `src/client/book-ui.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-progresion-design.md` §6 (Libro), §7 (Proezas), §9, §10.2, §11 (P4-D).

## Global Constraints

- Spanish, dry voice. `NAMES.book = 'Libro'`, `NAMES.feats = 'Proezas'`, `NAMES.featNames` (6), 3 more `NAMES.hatNames` in `names.ts`.
- **No new keys or pills.** Menú → "Libro" (with "Oficios" and "Aspecto" at its bottom).
- **No new client message.** Everything is server-side detection; `look` just accepts hats 7–9 (`decodeClient` via `isLook`, the server re-checks `hatUnlocked`).
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 57 → 58. New saved fields, all optional: `SavedPlayer.bosses?: string[]`, `kills?: Record<string, number>`, `raidsHeld?: number`, `feats?: number[]`. Old saves load with zeros; the dungeon bosses/elites are inferred from the powers (`bossesOf`).
- **[D] No `SavedPlayer.hats`:** every hat derives from a flag the save already has (milestones, and now `feats`), so the reserved list is not needed.
- **[D] Zones and days are world facts** (`cleansed.size`, `floor(time / DAY_LENGTH) + 1`), not per-player counters: simpler and what a kid means by "zonas limpias".
- **[D] The 11 bosses** (`BOSS_KINDS`): the 4 dungeon bosses (`boss`…`boss4`), the 4 dungeon elites (`elite`…`elite4`) and the 3 lieutenants (`lieut1` Gata, `lieut2` Triángulo, `lieut3` La Flecha). El Marchito shows as its own line (the `ending`). Counted on a killing blow to every living, connected player within `PROGRESS.near` (40 m), like the Savia.
- **[D] The 6 Proezas** (ids 1–6), each checked in one place:
  1. **Sin un rasguño** — the Tragón's first defeat: each fighter in the boss room who took no `hurt()` since the fight woke. → hat 7 *Papel doblado*.
  2. **Pez veloz** — the fish ring race done in ≤ 80 % of `FISH.rings × FISH.ringTime`. → sello.
  3. **Pies secos** — Nenúfares: from pad 0 to the last pad without touching the water and not on the frog. → sello.
  4. **Solo contra el frío** — at night, reach the Cumbre (`mountainDepth(z) ≥ MOUNTAINS.cumbre`) having started the night below it and never been warm (`nearFire`) since nightfall. → hat 8 *Gorro de nieve*.
  5. **Noche entera** — a raid ends at dawn with the Heart never below 50 % → every connected player. → sello.
  6. **Corazón quieto** — El Marchito falls (`winFinal`) while you are among `endingNames` with weapon ≤ +4. → hat 9 *Corona marchita*.
  A Proeza toasts "Proeza: Sin un rasguño." (+ "Nuevo sombrero: …" when it has one). One-time world fights (Tragón, El Marchito) can only give their Proeza in that fight: accepted.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/progression.ts` (+ test), `src/shared/names.ts`, `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/client/actors/hats.ts` (+ test), `src/client/game.ts`, `src/client/hud.ts`, `src/client/style.css`, version tests (57 → 58).
- Create `src/shared/sim/world-sim-p4d.test.ts`, `src/client/book-ui.ts` + `.test.ts`.

## Tasks

### Task 1: pure rules — Proezas, bosses, 3 more hats

```ts
export const FEATS = [1, 2, 3, 4, 5, 6] as const; // ids; NAMES.featNames[id - 1]
export const FEAT_HAT: Record<number, number> = { 1: 7, 4: 8, 6: 9 };
export const BOSS_KINDS = ['boss', 'elite', 'boss2', 'elite2', 'boss3', 'elite3', 'boss4', 'elite4', 'lieut1', 'lieut2', 'lieut3'] as const;
export function bossesOf(p: ProgressSource & { bosses?: string[] }): string[]; // saved ∪ inferred from powers, only BOSS_KINDS
export const HAT_IDS = [...6, 'papel', 'nieve', 'marchita'];
```

- [x] **Step 1: failing tests.** 6 feats with names; 11 boss kinds; `bossesOf({ viento: true })` has `boss2` and `elite2`; saved + inferred don't repeat; junk ids dropped; `isLook(0, 9)` true, `isLook(0, 10)` false; hats 7–9 locked without the feat and open with `feats: [1]`/`[4]`/`[6]`; each has a hint ("Se gana con la Proeza Sin un rasguño").
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(progresion): reglas puras de Proezas y Libro`.

### Task 2: server — counters, the 6 checks, `self.book` (protocolo v58)

- [x] **Step 1: failing tests** (`world-sim-p4d.test.ts`). Protocol 58; `self.book` for a new player is zeros, `feats: []`; a wolf killed by a strike adds `kills.wolf`; a lieutenant killed with Bea at 30 m adds it to both `bosses`; a held raid adds `raidsHeld` and, with the Heart ≥ 50 %, Proeza 5 to all; a raid where the Heart dipped below half gives no Proeza 5; the Tragón beaten by an unhurt Ana gives Proeza 1 (and hat 7 in `self.hats`), a hurt Bea none; the fish race fast → 2, slow → none; lily pads 0 → last dry → 3, after a splash → none; night climb to the Cumbre cold → 4, warmed by a fire → none; `winFinal` with weapon 4 → 6, weapon 5 → none; an old save without the fields loads.
- [x] **Step 2: implement** (`gainFeat(p, id)`; live flags `l.clean`, `l.lily`, `l.cold`, `l.raceAt`; `this.raidLow`, `this.bossHurt`).
- [x] **Step 3:** green (adapt 57 → 58 in the version tests and hat 7 → 10 as the out-of-range hat in `world-sim-p4c.test.ts`, noted), self-review, commit `feat(progresion): Proezas y contadores en el servidor (protocolo v58)`.

### Task 3: client — the Libro and the 3 hat shapes

- [x] **Step 1: failing tests.** `book-ui.ts`: `bookHtml(data)` shows "Rango 5 · 712 / 980 Savia" and a bar, "Arma +4 (×1,6) · Capa 2 (−20 %) · Aliento N", the 4 powers (missing ones `off`), the mounts, "Santuarios 8/12 · Cofres 3/6 · Jefes 4/11 · Zonas 9/22 · Día N", kills and raids, the 6 Proezas (done ones `done`), buttons `skills`, `look`, `back`. `makeHat(7..9)` one mesh each.
- [x] **Step 2: implement.** Menú "Libro" button (`onBook`) → panel; from it "Oficios" and "Aspecto" open their panels.
- [x] **Step 3:** green, self-review, commit `feat(progresion): el Libro en el Menú`.

### Task 4: Ship

- [x] Full suite green; push; HANDOFF: "Progresión — resumen" at the top of the Progresión area, "## Progresión · P4-D — …", the "Aventura completa — estado" paragraph (#4 done; next #6 Tiendas, #2 Visuales, #7 Pulido); one short comment on PR #3.
