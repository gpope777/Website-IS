# Aventura H — El Marchito: Invasión 1 y visiones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the players beat the Tragón de Papel (the first Raíz-madre), El Marchito speaks to them in a **vision** that names them. Twenty seconds later he walks into the base **in person**: a huge dark paper spirit that marches from the Raíz-madre's side, smashes **half the defenses** (the walls, spikes and campfires nearest the Heart), swats anyone in his way, laughs and leaves. He cannot be killed: blows and parries wear down his **voluntad**; at 0 he is driven off early. It happens once per world. Raids now come from the Raíz-madre's direction (the corruption's source), and once it is purified they are weaker (spec §3: "purifying it weakens raids from that direction").

**Architecture:** Rules in `src/shared/sim/marchito.ts` (constants, `pickDefenses`, `createMarchito`, `stepMarchito`, vision lines). `WorldSim` owns the invasion lifecycle (`invasion: 'none' | 'pending' | 'done'`, saved as the optional `SavedWorld.invasion`), keeps El Marchito as a live-only record next to the boss (so attack/shoot/lock/parry reuse `enemy(id)`), and sends a new one-off `{ t: 'vision', lines }` message. The raid direction comes from `generateEntrance` (already on the sim). The client draws him with `PaperActor` (a nephew drawing, dark tint, 7 m), shows a voluntad bar in the boss line, and shows visions in a dismissible card.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §2 (El Marchito, presence, invasion 1), §3 (corruption per direction), §12 ("Invasion 1 of El Marchito"). Plan map: see Plan A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Plural "ustedes" like the existing raid text.
- **Phones first.** No new pill (grid stays at 10). Hitting him uses the existing A / 🏹 / 🎯 / 🛡️. The vision card has its own **✕ button** (touch and mouse) and closes with **Enter** (new `'dismiss'` action) or by itself after a few seconds.
- **Trust boundary:** no new client message. `attack` / `shoot` with his id go through the existing checks (reach, cone, cooldown). The server decides everything about the invasion.
- **He cannot die.** His hp is "voluntad"; at 0 he leaves (driven off). He never damages the Heart itself (the spec: "wrecks half the defenses"), only walls, spikes and campfires, plus players he swats.
- **Once per world.** Triggered only by the Tragón's defeat transition (not by loading a save with `purified: true`), so old worlds that already beat the boss get no surprise invasion. Recorded decision.
- **The world sleeps:** he only moves while someone is online and active; saving mid-invasion stores `'pending'` (he comes back on the next load, the wrecked defenses stay wrecked).
- **Protocol:** `PROTOCOL_VERSION` 8 → 9. `EnemyKind` gains `'marchito'`; snap gains `marchito: MarchitoView | null`; `ServerMsg` gains `{ t: 'vision'; lines: string[] }`. `SavedWorld.invasion?` is optional: old saves load.
- Run `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Shared rules for El Marchito + protocol v9

**Files:**
- Create: `src/shared/sim/marchito.ts`, `src/shared/sim/marchito.test.ts`
- Modify: `src/shared/sim/wolves.ts` (`ENEMY.marchito`, label), `src/shared/protocol.ts`, `src/shared/protocol.test.ts`

**Interfaces (produces):**
```ts
export const MARCHITO = { id: 900_000, delay: 20, spawnDist: 28, smashReach: 2.6, smashTime: 1.2, laughFor: 4, maxTime: 120, height: 7 } as const;
// ENEMY.marchito = { hp: 400, run: 3.2, damage: 18, reach: 3, biteCooldown: 2.5 }  (hp = voluntad)
export interface Marchito extends Wolf { prey: number[]; smash: number; laugh: number; age: number; taunted: string[] }
export function pickDefenses(structs: readonly { id: number; kind: string; x: number; z: number }[], heart: { x: number; z: number }): number[]
export function createMarchito(x: number, y: number, z: number, prey: number[]): Marchito
export type MarchitoEvent = { t: 'smash'; id: number } | { t: 'swipe'; name: string } | { t: 'laugh' } | { t: 'leave' } | null;
export function stepMarchito(m: Marchito, structs: readonly { id: number; x: number; z: number }[], players: readonly WolfTarget[], heightAt: (x: number, z: number) => number, dt: number): MarchitoEvent
export function joinNames(names: readonly string[]): string   // "Ana", "Ana y Leo", "Ana, Leo y Eva"
export const VISION: { purified(names: string): string[]; arrive: string[]; laugh: string[]; driven(names: string): string[]; taunt(name: string): string }
```
Protocol: `EnemyKind = 'wolf' | 'brute' | 'boss' | 'marchito'`; `MarchitoView { will: number; max: number; laughing: boolean }`; snap `marchito: MarchitoView | null`; `ServerMsg | { t: 'vision'; lines: string[] }`.

- [ ] **Step 1: failing tests** (`marchito.test.ts`)
```ts
const heart = { x: 0, z: 0 };
const s = (id: number, kind: string, x: number) => ({ id, kind, x, z: 0 });
it('picks the nearer half of the defenses, never the Heart', () => {
  expect(pickDefenses([s(1, 'heart', 0), s(2, 'wall', 3), s(3, 'wall', 9), s(4, 'spikes', 5), s(5, 'campfire', 20)], heart)).toEqual([2, 4]);
  expect(pickDefenses([s(1, 'wall', 4), s(2, 'wall', 8), s(3, 'wall', 12)], heart)).toEqual([1, 2]);
  expect(pickDefenses([s(1, 'heart', 0)], heart)).toEqual([]);
});
it('walks to its prey, smashes it after smashTime, then laughs and leaves', () => {
  const m = createMarchito(10, 0, 0, [7]);
  const structs = [{ id: 7, x: 0, z: 0 }];
  const ev: MarchitoEvent[] = [];
  for (let i = 0; i < 200; i++) { const e = stepMarchito(m, structs.filter(x => m.prey.includes(x.id)), [], () => 0, 0.1); if (e) ev.push(e); }
  expect(ev[0]).toEqual({ t: 'smash', id: 7 });
  expect(ev[1]).toEqual({ t: 'laugh' });
  expect(ev[2]).toEqual({ t: 'leave' });
});
it('prey that is already gone is skipped', ...);
it('swats a living player in reach, then waits its cooldown', ...);
it('a stunned Marchito does nothing', ...);
it('gives up and laughs after maxTime', ...);
it('names read naturally', () => { expect(joinNames(['Ana'])).toBe('Ana'); expect(joinNames(['Ana', 'Leo'])).toBe('Ana y Leo'); expect(joinNames(['Ana', 'Leo', 'Eva'])).toBe('Ana, Leo y Eva'); });
```
Protocol tests: `PROTOCOL_VERSION` is 9.
- [ ] **Step 2: implement.** `stepMarchito`: `age += dt`, `cooldown -= dt`. Laughing → count down, `leave` at 0. Stunned → idle. A living player within `reach` and `cooldown === 0` → `swipe` (cooldown = `biteCooldown`, anim `attack`). Drop prey ids missing from `structs`. No prey or `age ≥ maxTime` → `laugh = laughFor`, event `laugh`. Else walk to the first prey (`run`), and within `smashReach` accumulate `smash`; at `smashTime` → `smash`, shift the prey.
- [ ] **Step 3:** green + check (the new `EnemyKind` member forces `ENEMY`/`ENEMY_LABELS` entries). Commit `feat(aventura): El Marchito rules and protocol v9`.

### Task 2: Server — visions and Invasion 1

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `src/shared/sim/world-sim.test.ts`.

- `SavedWorld.invasion?: 'pending' | 'done'`; `WorldSim.invasion: 'none' | 'pending' | 'done'`, `invasionAt` (live: `time + MARCHITO.delay` on load if pending), `private marchito: Marchito | null`.
- In `stepBossFight`, on the purify transition: `this.vision(VISION.purified(joinNames(active names)))`; if `invasion === 'none'` → `'pending'`, `invasionAt = time + delay`.
- `stepInvasion(dt)` (after `stepAlly`): pending, `time ≥ invasionAt`, a Heart, and an active alive player outside the dungeon → spawn `spawnDist` from the Heart toward the Raíz-madre (`atan2(entrance.x − heart.x, entrance.z − heart.z)`), clamped inside the map; `prey = pickDefenses(structures, heart)`; `vision(VISION.arrive)`. Active and `activeCount() > 0` → `stepMarchito`: `smash` → `wreck`; `swipe` → `bite(name, ENEMY.marchito.damage, m)` (roll/block/parry apply); `laugh` → `vision(VISION.laugh)`; `leave` → `marchito = null`, `invasion = 'done'`.
- `enemy(id)` also returns him. `strike` on him: `hp = max(0, hp − dmg)`, first hit per player → `tell(VISION.taunt(name))`; at 0 → `vision(VISION.driven(names))`, gone, `'done'`. Never "derrotó".
- Snapshot: his `WolfView` (kind `'marchito'`) when near; `marchito: { will, max, laughing }` for everyone while he is here.
- `save()`: `invasion` = `'done'` → `'done'`; pending or active → `'pending'`; none → omitted.
- [ ] Tests: beating the boss sends a vision naming the players and makes the invasion pending (and saved); a world loaded with `purified: true` but no `invasion` never gets invaded; he arrives after the delay from the Raíz-madre's side; he smashes the nearer half of the defenses and never the Heart, then laughs and leaves (`'done'`, no second invasion); hits wear his voluntad and at 0 he is driven off (vision, `'done'`); taunt only once per player; he swats a player next to him; nobody active → he freezes; save mid-invasion → `'pending'`.
- [ ] Commit `feat(aventura): El Marchito's visions and first invasion`.

### Task 3: Server — corruption from the Raíz-madre, weaker after purifying

**Files:** Modify `src/shared/sim/wolves.ts` (`RAID.jitter`, `RAID.cleansed`), `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- `stepRaid`: `dir = rootDir(heart) + (rng() − 0.5) * RAID.jitter` (jitter 0.8 rad). Warning text: before purifying `'El cielo se tiñe de morado hacia la Raíz-madre. El Marchito envía a sus bestias: vuelvan al Corazón'`; after, `'Restos de corrupción desde la Raíz-madre. Vienen menos: vuelvan al Corazón'`.
- `spawnRaiders`: purified → `n = max(1, ceil(n * RAID.cleansed))` (0.6) and no brutes.
- [ ] Tests: the warned direction points at the Raíz-madre within jitter; purified waves are smaller and brute-free.
- [ ] Commit `feat(aventura): raids come from the Raíz-madre and weaken once it is purified`.

### Task 4: Client — El Marchito, his bar and visions

**Files:** Modify `src/client/game.ts`, `src/client/hud.ts`, `src/client/style.css`, `src/client/input.ts`, `src/client/dungeon-ui.ts`; Tests `src/client/dungeon-ui.test.ts`, `src/client/input.test.ts`.

- `marchitoBarText(v: MarchitoView | null): string | null` → `'El Marchito · voluntad 320/400'` or `'El Marchito se ríe'`. The boss line shows `bossBarText(dungeon) ?? marchitoBarText(marchito)`.
- `KEY_ACTIONS.Enter = 'dismiss'` → `hud.hideVision()`.
- `Hud.showVision(lines)`: a card at the top centre (italic lines, a ✕ button with `pointer-events: auto`), auto-hides after `3 s + 2.5 s × lines`. Also mirrored in the log.
- `WolfView.kind === 'marchito'` → `PaperActor('/enemies/enemy15.png', MARCHITO.height, camera, 640 / 1010)` tinted dark purple (`0x7a5a8c`), lighter while laughing.
- Menu help line: `'El Marchito: no se le puede matar. Golpes y paradas le quitan voluntad; Enter / ✕ cierra una visión'`.
- [ ] Tests: `marchitoBarText` cases; `Enter` maps to `'dismiss'`. Build + check.
- [ ] Commit `feat(aventura): El Marchito and his visions on the client`.

### Task 5: Ship

- [ ] `git push origin aventura/slice-1` (retry 2/4/8/16 s on network errors).
- [ ] Append "## Plan H — …" to `docs/superpowers/HANDOFF-aventura.md` (Spanish): commits, tests, decisions, blockers, what to test. Commit + push. One short note on PR #2.

## Self-review notes

- Spec §2 coverage: visions when a root-mother is purified (the Tragón's defeat), reacting to players (names in the vision, a taunt the first time each player hits him); Invasion 1 "wrecks half the defenses, laughs and leaves"; "cannot kill him: survive or drive him off" (voluntad). Invasions 2–3 are out of slice 1.
- §3 corruption per direction: with one biome and one Raíz-madre, "direction" = the Raíz-madre's side of the Heart; purifying it weakens those raids (×0.6, no brutes). Per-zone corruption spreading is still out (no zones exist yet).
- Tower on the horizon (§2) is out: it belongs to the last biome.
- "Half the defenses" = the nearer half (rounded up) of walls, spikes and campfires, counted when he arrives. Structures built during the invasion are safe.
- Old worlds that already beat the Tragón are not invaded (no trigger); only a fresh defeat triggers it.
- No new client message; hitting him reuses attack/shoot, so no new validation surface.
