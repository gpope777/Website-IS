# Aventura E — Enredadera y 3 santuarios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three small shrines stand in the open world, each glowing on the horizon with a one-puzzle challenge (two distant levers, a timed pressure plate, a smooth rock you cannot climb). Solving one gives an **upgrade orb** (+20 max stamina). The first orb awakens **Enredadera**, the first active power: it grows a climbable vine pillar where you aim, or wraps a smooth shrine rock so it becomes climbable, and walls near a living vine slowly regenerate.

**Architecture:** Shrines are generated from the seed in `src/shared/shrines.ts` (like crags in Plan D), so client and server agree on where they are and on the geometry of their parts without protocol traffic. Puzzle state (levers pulled, plate pressed, open timers) is live-only in `WorldSim`; which shrines each player has cleared is saved (`SavedPlayer.shrines?`). The power is server-authoritative: the client sends `{t:'power', x, z}`, the server validates unlock/cooldown/reach/space and adds a **vine** (a `Crag` with an owner and an expiry) to the list of climbables used by the move check. Vines and shrine states ride on `snap`. The client merges static crags, bare shrine pillars and vines into one climbable list for the existing `stepBody`; `Crag.bare` marks a pillar you can stand on but not grab.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §5 (active power), §6 (Enredadera: "creates climbable spots"; "living walls that regenerate"), §7 (shrines: one puzzle, reward = upgrade orb; co-op puzzles always solvable solo), §8 (fallback: marked surfaces + Enredadera creates climbable spots), §12 (3 shrines). Foundation: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`.

## Decisions (recorded)

1. **Where Enredadera comes from.** The spec gives each power at the end of a big dungeon, and the dungeon is Plan F. So that E is playable on its own, **the first shrine orb awakens Enredadera**. Plan F can move the unlock to the dungeon (the rule is one line: `hasPower = cleared.length > 0`).
2. **Upgrade orb = +20 max stamina** (client-side meter, like the rest of stamina). Simplest upgrade that matters for the traversal of Plan D; weapons/health upgrades can come with progression.
3. **Shrines are per player.** Each player can clear each shrine once and gets their own orb. Puzzle state is shared (a friend can hold the plate or pull the second lever), so co-op helps but solo always works.
4. **The three puzzles** (spec §7 templates, simplest versions):
   - **Palancas:** two levers 20 m apart. Pull both within 6 s → the gate opens for 30 s. Solo: pull, sprint, pull.
   - **Losa:** a pressure plate 14 m from the orb. While someone stands on it and 3.5 s after, the gate is open. Solo: sprint (walking is too slow); co-op: a friend stands on it.
   - **Roca lisa:** the orb sits on a 10 m bare pillar. Bare pillars cannot be climbed; Enredadera wraps it in vines so it can. Needs the power, so it is the last shrine by design.
5. **The gate is logical**, not a collider: the orb just refuses to be taken while closed (a ring of light shows closed/open).
6. **Vines:** one per player (a new cast replaces the old), last 90 s, cooldown 12 s, reach 6 m. A fresh vine is a 1.2 m-wide, 8 m-tall green pillar. Walls within 6 m of any vine regain 5 HP/s ("living walls"); the HP broadcast is batched once per second.
7. **Touch:** the grid stays at 10 pills: the 🎥 cámara pill becomes 🌿 **poder** (the camera toggle stays in the Menú and on C). Keyboard: **H**. Shrine levers/orbs use the contextual A / E button.

## Global Constraints

- All player-facing text in **Spanish**, dry voice.
- **Phones first:** every new action has a key and a touch button (H / 🌿; A / E for shrine parts).
- **Trust boundary:** new messages go through `decodeClient`. The server re-checks unlock, cooldown, reach, dead state, shrine state and cleared list.
- **Protocol:** new messages `power` and `shrine`, new `snap` fields `vines`/`shrines`, new `SelfState` fields `shrines`/`powerLeft` → `PROTOCOL_VERSION` 5 → 6. `SavedPlayer.shrines` is optional: old saves load.
- Run `npm test && npm run test:workers && npm run check && npm run build` before every commit.
- Commit messages end with the `Co-Authored-By` + `Claude-Session` trailer.

---

### Task 1: Shrines + vines (shared) and protocol v6

**Files:**
- Create: `src/shared/shrines.ts`, `src/shared/shrines.test.ts`, `src/shared/enredadera.ts`, `src/shared/enredadera.test.ts`
- Modify: `src/shared/crags.ts` (`bare?: boolean`), `src/shared/protocol.ts`, `src/shared/protocol.test.ts`

**Interfaces:**
- Produces: `ShrineKind`, `Shrine { id; kind; x; z; y; orb; parts; pillar }`, `SHRINE`, `SHRINE_LABELS`, `generateShrines(terrain, seed, crags): Shrine[]`
- Produces: `ENREDADERA`, `planVine(terrain, blockers, bare, x, z, id): Crag | null`
- Produces: `Crag.bare?: boolean`; `ShrineView { id; open; parts: boolean[] }`; snap `vines: Crag[]`, `shrines: ShrineView[]`; `SelfState.shrines: number[]`, `SelfState.powerLeft: number`; ClientMsg `{t:'power'; x; z}`, `{t:'shrine'; id; part}`; `PROTOCOL_VERSION = 6`

- [ ] **Step 1: Failing tests**

```ts
// shrines.test.ts
import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateShrines, SHRINE } from './shrines';

describe('shrines', () => {
  for (const seed of [1, 7, 42, 1234]) {
    it(`places one shrine of each kind on dry land (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const crags = generateCrags(t, seed);
      const s = generateShrines(t, seed, crags);
      expect(s).toEqual(generateShrines(t, seed, crags));
      expect(s.map((x) => x.kind)).toEqual(['levers', 'plate', 'ledge']);
      for (const sh of s) {
        const d = Math.hypot(sh.x, sh.z);
        expect(d).toBeGreaterThanOrEqual(SHRINE.minDist - 1e-6);
        expect(Math.abs(sh.x)).toBeLessThan(HALF - 20);
        for (const p of [sh, ...sh.parts]) expect(t.heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL);
        for (const c of crags) expect(Math.hypot(c.x - sh.x, c.z - sh.z)).toBeGreaterThan(SHRINE.cragClear);
      }
      const [levers, plate, ledge] = s;
      expect(levers!.parts).toHaveLength(2);
      expect(plate!.parts).toHaveLength(1);
      expect(ledge!.pillar?.bare).toBe(true);
      expect(ledge!.orb.y).toBeGreaterThan(ledge!.pillar!.top);
    });
  }
});
```

```ts
// enredadera.test.ts
import { describe, expect, it } from 'vitest';
import type { Crag } from './crags';
import { ENREDADERA, planVine } from './enredadera';
import type { Terrain } from './terrain';

const flat: Terrain = { heightAt: () => 1, density: () => 0 };
const rock: Crag = { id: 0, x: 10, z: 0, r: 3, base: 0, top: 12 };
const bare: Crag = { id: 1000, x: -10, z: 0, r: 2.2, base: 0, top: 11, bare: true };

describe('planVine', () => {
  it('grows a new climbable pillar on open ground', () => {
    const v = planVine(flat, [rock], [bare], 0, 0, 2001)!;
    expect(v).toMatchObject({ id: 2001, x: 0, z: 0, r: ENREDADERA.r, top: 1 + ENREDADERA.height });
    expect(v.bare).toBeUndefined();
  });
  it('wraps a bare pillar next to the target, keeping its id and shape', () => {
    expect(planVine(flat, [], [bare], -10 + 3, 0, 2001)).toEqual({ id: 1000, x: -10, z: 0, r: 2.2, base: 0, top: 11 });
  });
  it('refuses water and crowded spots', () => {
    expect(planVine({ heightAt: () => -10, density: () => 0 }, [], [], 0, 0, 1)).toBeNull();
    expect(planVine(flat, [rock], [], 10 - 3.5, 0, 1)).toBeNull();
  });
});
```

`protocol.test.ts`: `decodeClient` accepts `{t:'power',x:1,z:2}` and `{t:'shrine',id:0,part:2}`, rejects `part: 3`, `part: -1`, non-finite `x`.

- [ ] **Step 2: Run, see red.** `npx vitest run src/shared`

- [ ] **Step 3: Implement**

```ts
// shrines.ts
export type ShrineKind = 'levers' | 'plate' | 'ledge';
export const SHRINE_KINDS: readonly ShrineKind[] = ['levers', 'plate', 'ledge'];
export const SHRINE_LABELS: Record<ShrineKind, string> = { levers: 'Santuario de las Palancas', plate: 'Santuario de la Losa', ledge: 'Santuario de la Roca Lisa' };
export const SHRINE = {
  minDist: 70, maxDist: 150, cragClear: 14, orbReach: 2, partReach: 2.5,
  leverGap: 10, leverWindow: 6, openFor: 30, plateDist: 14, plateRadius: 1.3, plateHold: 3.5,
  pillarR: 2.2, pillarH: 10, pillarId: 1000,
} as const;
export interface Shrine { id: number; kind: ShrineKind; x: number; z: number; y: number; orb: { x: number; y: number; z: number }; parts: { x: number; z: number }[]; pillar: Crag | null }

/** One per kind, a third of a circle apart around spawn; up to 60 tries each, then the driest candidate. */
export function generateShrines(terrain: Terrain, seed: number, crags: readonly Crag[]): Shrine[] {
  const rng = createRng(seed ^ 0x5a17c0de);
  const base = rng() * Math.PI * 2;
  return SHRINE_KINDS.map((kind, id) => {
    let pick: Shrine | null = null;
    for (let tries = 0; tries < 60 && !pick; tries++) {
      const ang = base + (id * Math.PI * 2) / 3 + (rng() - 0.5) * 1.2;
      const d = SHRINE.minDist + rng() * (SHRINE.maxDist - SHRINE.minDist);
      const s = layout(terrain, id, kind, Math.sin(ang) * d, Math.cos(ang) * d, ang);
      if (fits(terrain, crags, s)) pick = s;
    }
    return pick ?? layout(terrain, id, kind, Math.sin(base + (id * Math.PI * 2) / 3) * SHRINE.minDist, Math.cos(base + (id * Math.PI * 2) / 3) * SHRINE.minDist, base);
  });
}
```

`layout` puts levers at ±`leverGap` across the approach direction, the plate `plateDist` to one side, and for `ledge` a bare pillar (`id: SHRINE.pillarId + id`, top = highest ground under it + `pillarH`) with the orb 1 m above its top. `fits` checks every point is > `WATER_LEVEL + 0.3`, inside `HALF - 20`, and no crag within `cragClear`.

```ts
// enredadera.ts
export const ENREDADERA = { reach: 6, cooldown: 12, life: 90, r: 1.2, height: 8, wrapPad: 2, regenRadius: 6, regen: 5, idBase: 2000 } as const;

/** Where a cast lands: wraps a bare pillar within `wrapPad` of its side, else a new pillar on dry, free ground; null when blocked. */
export function planVine(terrain: Terrain, blockers: readonly Crag[], bare: readonly Crag[], x: number, z: number, id: number): Crag | null {
  const wrap = bare.find((c) => Math.hypot(x - c.x, z - c.z) < c.r + ENREDADERA.wrapPad);
  if (wrap) { const { bare: _b, ...c } = wrap; return c; }
  const g = terrain.heightAt(x, z);
  if (g < WATER_LEVEL + 0.2) return null;
  if ([...blockers, ...bare].some((c) => Math.hypot(x - c.x, z - c.z) < c.r + ENREDADERA.r + 0.5)) return null;
  return { id, x, z, r: ENREDADERA.r, base: g - 0.5, top: g + ENREDADERA.height };
}
```

Protocol: add the messages, `ShrineView`, snap/self fields, `PROTOCOL_VERSION = 6`; `part` must be an integer 0..2. Fix every constructor of `SelfState`/`snap` that `npm run check` flags (world-sim gets stubs `shrines: []`, `powerLeft: 0`, `vines: []`, `shrines: []` until Tasks 2–3).

- [ ] **Step 4: Green + check + build. Commit** `feat(aventura): shrines and vines (shared) + protocol v6`

### Task 2: Shrine puzzles on the server

**Files:** Modify `src/shared/sim/world-sim.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces: `WorldSim.shrines: readonly Shrine[]`; `SavedPlayer.shrines?: number[]`; `{t:'shrine'}` handling; snap `shrines`; `self.shrines`
- Consumes: `generateShrines`, `SHRINE`

- [ ] **Step 1: Failing tests** (in `world-sim.test.ts`, using `put`):

```ts
describe('shrines', () => {
  const lev = (sim: WorldSim) => sim.shrines.find((s) => s.kind === 'levers')!;
  it('the orb stays shut until both levers are pulled within the window', () => {
    const sim = setup('Ana');
    const s = lev(sim);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 0 });
    expect(snap(sim, 'Ana').self.shrines).toEqual([]);
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 1 });
    for (let i = 0; i < 70; i++) sim.step(0.1); // too slow
    put(sim, 'Ana', s.parts[1]!.x, s.parts[1]!.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 2 });
    expect(snap(sim, 'Ana').shrines.find((v) => v.id === s.id)!.open).toBe(false);
    put(sim, 'Ana', s.parts[0]!.x, s.parts[0]!.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 1 });
    expect(snap(sim, 'Ana').shrines.find((v) => v.id === s.id)!.open).toBe(true);
    put(sim, 'Ana', s.orb.x, s.orb.z);
    sim.handle('Ana', { t: 'shrine', id: s.id, part: 0 });
    expect(snap(sim, 'Ana').self.shrines).toEqual([s.id]);
    expect(sim.save().players[0]!.shrines).toEqual([s.id]);
  });
  it('the plate opens the gate while pressed and a few seconds after', () => { /* stand on plate, step, leave, step 2 s: open; step 2 s more: shut */ });
  it('the ledge orb needs you on top of the pillar', () => { /* at ground: refused; p.y = pillar.top: taken */ });
  it('a friend can hold the plate while you take the orb; each player clears once', () => { /* Leo on plate, Ana takes orb; second take ignored */ });
  it('old saves without shrines load', () => { /* delete players[i].shrines; new WorldSim(saved) → self.shrines [] */ });
  it('ignores far players, dead players and bad ids/parts', () => { /* ... */ });
});
```

- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement.** Live state per shrine `{ pulled: [number|null, number|null], openUntil: number, pressed: boolean }`. `stepShrines()` each tick: a plate is pressed by any alive active player within `plateRadius` (and within 1.5 m of ground height) → `openUntil = time + plateHold`. Levers: pulling sets `pulled[n]`; if the other lever was pulled within `leverWindow`, `openUntil = time + openFor`. `ledge` is always open. Orb (`part 0`): shrine open, not cleared, horizontal distance ≤ `orbReach` (ledge: ≤ pillar r) and `p.y ≥ orb.y − 2.5` → `p.shrines.push(id)`; toast `Orbe de mejora: +20 de aliento`; first orb adds `Despierta la Enredadera: H o 🌿 hace crecer una enredadera trepable`. Texts for levers: `La palanca cede. Falta la otra` / `Algo se abre en el santuario`; closed orb: `Una verja de luz lo protege`.
- [ ] **Step 4: Green. Commit** `feat(aventura): shrine puzzles and upgrade orbs on the server`

### Task 3: Enredadera on the server

**Files:** Modify `src/shared/sim/world-sim.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces: `WorldSim.climbables(): Crag[]` (crags + bare pillars not wrapped + vines); `{t:'power'}` handling; snap `vines`; `self.powerLeft`
- Consumes: `planVine`, `ENREDADERA`

- [ ] **Step 1: Failing tests**
  - Without a cleared shrine: `power` does nothing and toasts `Aún no tienes ese poder`.
  - With one: a vine appears in `snap.vines` at the target; `powerLeft` = 12; a second cast inside the cooldown is refused; after the cooldown a new cast replaces the first (one per player).
  - A target farther than 6 m, or in water, is refused.
  - The vine expires after 90 s.
  - A move up a fresh vine (y = vine top) is accepted, the same move without the vine is rejected (`fix`).
  - Casting next to the ledge pillar wraps it: `snap.vines` contains the pillar id; standing on top then taking the orb works.
  - A damaged wall within 6 m of a vine regains HP (and a `hit` goes out); a wall far away does not.
  - Dead players cannot cast.
- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement.** `vines: (Crag & { owner: string; until: number })[]`, `nextVineId = ENREDADERA.idBase`, `Live.powerReadyAt`. `onPower` checks dead → unlock (`(p.shrines ?? []).length > 0`) → cooldown (`La enredadera aún no brota (N s)`) → reach (`Demasiado lejos`) → `planVine(terrain, crags + other vines, bare pillars not wrapped, x, z, id)` (`No hay sitio para crecer`) → replace own vine, toast `Crece una enredadera`. `step`: drop expired vines; regen walls near vines, broadcast `hit` once per second. `onMove` uses `cragsNear(this.climbables(), …)`.
- [ ] **Step 4: Green. Commit** `feat(aventura): Enredadera power: vines, wrapped rocks, living walls`

### Task 4: Client rules: bare rocks, bigger stamina, the power button

**Files:** Modify `src/client/movement.ts`, `src/client/movement.test.ts`, `src/client/input.ts`, `src/client/input.test.ts`, `src/client/touch.ts`

**Interfaces:**
- Produces: `Body.staminaMax`; `staminaFor(orbs: number): number`; `Action` gains `'power'` on `KeyH`; pill 🌿 `poder` replaces 🎥 `cámara`.

- [ ] **Step 1: Failing tests**
  - Pushing into a `bare` crag does not grab it (you bump into it), but you can stand on its top.
  - `staminaFor(0) === 100`, `staminaFor(2) === 140`; with `b.staminaMax = 140` the meter regenerates up to 140 and `tired` clears only at 140.
  - `KEY_ACTIONS.KeyH === 'power'`.
- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement** (grab rule adds `!cr.bare`; `regen` caps at `b.staminaMax`; `createBody` sets `staminaMax: STAMINA.max`; `STAMINA.perOrb = 20`).
- [ ] **Step 4: Green. Commit** `feat(aventura): client rules for bare rocks, orb stamina and the power key`

### Task 5: Client: shrines, vines, prompts

**Files:**
- Create: `src/client/scene/shrines.ts`
- Modify: `src/client/scene/crags.ts` (bare pillars without vine strips; `buildVine`), `src/client/game.ts`, `src/client/hud.ts` (menu help)

- [ ] **Step 1:** `ShrineMeshes` — per shrine: a tall translucent beam (the horizon lure, hidden once you cleared it), a glowing orb (dim while shut, bright when open, hidden once cleared), a ring of light around it (the gate), two lever posts whose handle tips when pulled, a stone plate that glows while pressed, and for the ledge a bare rock pillar. `sync(views, cleared)`, `animate(t)`.
- [ ] **Step 2:** `game.ts`: generate shrines with the world; `climbables()` = crags + bare pillars (unless a vine with the same id exists) + snap vines, passed to `stepBody` and the crag prompt; drop `body.climb` when its vine is gone; resources inside a pillar are hidden; `staminaMax = staminaFor(self.shrines.length)`; `act()` pulls a lever / takes an orb within reach (after revive, before attacking); `power()` sends the bare pillar's centre when one is within 3 m of its side, else a point 2 m ahead. Prompts: `E · Tirar de la palanca`, `E · Tomar el orbe`, `La verja está cerrada`, `H · Enredadera` next to a bare rock (or `Roca lisa: no hay agarre` without the power).
- [ ] **Step 3:** Menu help line: `H / 🌿 Enredadera: hace crecer una enredadera trepable (o cubre una roca lisa). Los muros cerca de ella se regeneran. Santuarios: haces de luz en el horizonte.`
- [ ] **Step 4:** Check + build + all tests; local browser look if possible. **Commit** `feat(aventura): shrines and vines on the client`

### Task 6: Ship

- [ ] Append `## Plan E — …` to `docs/superpowers/HANDOFF-aventura.md` (Spanish): commits, tests, decisions, blockers, what to test.
- [ ] `git push origin aventura/slice-1`; one short comment on PR #2.

## Self-review notes

- Spec coverage: §5 active power (Enredadera, H/🌿), §6 Enredadera exploration (climbable spots) + defense (regenerating walls), §7 shrines with one puzzle and an orb, co-op helps but solo works, §12 three shrines. Root bridges (§6) are left out: there are no gaps to bridge on this terrain.
- Deviations: Enredadera unlocked by the first orb instead of the dungeon (Plan F may move it); orb = +20 stamina; gate is logical, not a collider.
- ponytail: stamina stays client-side, so the orb's bonus is trusted like the rest of it. Raiders still walk through pillars and vines.
- Types line up: `Crag` is reused for vines and pillars; `ShrineView.parts` is lever pulled / plate pressed, in `Shrine.parts` order.
