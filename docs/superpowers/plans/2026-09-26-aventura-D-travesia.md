# Aventura D — Travesía: trepar, planeador, nadar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players climb marked rock pillars (peñascos con enredadera) with a stamina meter, open a glider in the air to drift off them, and sprint-swim at a stamina cost. The server accepts the heights and paths this produces instead of snapping players back.

**Architecture:** Crags are generated deterministically from the world seed in `src/shared/crags.ts`, so client and server agree on where they are without any protocol traffic. All traversal physics stays client-side in the pure `src/client/movement.ts` (`stepBody`), like walking and the roll dash today; stamina is client-side too. The server's move check in `WorldSim.onMove` learns two rules: near a crag you may be up to its top + 3 m, and anywhere else above `ground + 4` you may only go down (gliding/falling). Two new anims (`climb`, `glide`) ride on the existing `move`/`snap` messages.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §6 (Traversal) and §12. Foundation: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`.

## Decision: fallback (marked surfaces), not free climbing

The spec asks for a free-climbing spike with a fallback to marked surfaces. We take the **fallback** up front, for measured reasons:

1. **There is nothing to free-climb.** The terrain is a smooth noise heightfield. Sampling 4 seeds on a 2 m grid: ~80 % of the map is under 10°, ~19 % is 10–20°, ~1 % is 20–30°, and **0 % is steeper than 30°**. Free climbing on this terrain would just be walking.
2. **A heightfield cannot hold walls.** Cliffs worth climbing need vertical faces (and ideally overhangs), which a `heightAt(x, z)` function cannot represent. Adding them means a new terrain representation, which touches worldgen, resource placement, raider pathing and the server move check. That is far bigger than a spike.
3. **Phones.** "Push the stick into a marked rock" needs no extra button and no surface-normal guessing on a small screen.

The spec already says "climbable" is a flag on terrain and objects so switching costs nothing: `Crag` is that flag's first user. Enredadera (Plan E) can add climbable spots by pushing into the same list.

## Global Constraints

- All player-facing text in **Spanish**, dry voice.
- **Phones first:** no new pill (the grid is full at 10). Climbing is contextual (push the stick into a crag); the glider and the leap off a wall use **B / Space** (already a held button); fast swimming uses sprint (Shift / stick at the edge).
- **Trust boundary:** client messages still go through `decodeClient`. The server keeps its speed check (`MAX_SPEED = 9`; glide speed 7 fits) and gains only the two height rules above. Stamina is client-side, like the roll dash (co-op game; recorded as a ponytail).
- **Protocol:** `ANIMS` gains `climb` and `glide`, so `PROTOCOL_VERSION` 4 → 5. Nothing new is saved: old saves load unchanged.
- Run `npm test && npm run test:workers && npm run check && npm run build` before every commit.
- Commit messages end with the `Co-Authored-By` + `Claude-Session` trailer.

---

### Task 1: Crags (shared) + protocol anims

**Files:**
- Create: `src/shared/crags.ts`, `src/shared/crags.test.ts`
- Modify: `src/shared/protocol.ts`, `src/shared/protocol.test.ts`

**Interfaces:**
- Produces: `Crag { id; x; z; r; base; top }`, `CRAG`, `generateCrags(terrain, seed): Crag[]`, `cragsNear(crags, x, z, pad): Crag[]`, `cragTopAt(crags, x, z, y): number | null`
- Produces: `Anim` includes `'climb' | 'glide'`; `PROTOCOL_VERSION = 5`

- [ ] **Step 1: Failing tests** (`crags.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { CRAG, cragsNear, cragTopAt, generateCrags } from './crags';

describe('crags', () => {
  const t = createTerrain(42);
  const crags = generateCrags(t, 42);

  it('is deterministic and places a handful per world', () => {
    expect(generateCrags(t, 42)).toEqual(crags);
    expect(crags.length).toBeGreaterThanOrEqual(8);
    expect(crags.length).toBeLessThanOrEqual(64);
  });

  it('stands on dry land, away from spawn and the rim, and is tall enough to matter', () => {
    for (const c of crags) {
      expect(Math.hypot(c.x, c.z)).toBeGreaterThan(CRAG.spawnClear);
      expect(Math.abs(c.x)).toBeLessThan(HALF - 20);
      expect(t.heightAt(c.x, c.z)).toBeGreaterThan(WATER_LEVEL);
      expect(c.top - t.heightAt(c.x, c.z)).toBeGreaterThanOrEqual(CRAG.minH - 0.01);
    }
  });

  it('finds crags near a point and the top you can stand on', () => {
    const c = crags[0]!;
    expect(cragsNear(crags, c.x + c.r + 0.5, c.z, 1)).toContain(c);
    expect(cragsNear(crags, c.x + c.r + 5, c.z, 1)).not.toContain(c);
    expect(cragTopAt(crags, c.x, c.z, c.top)).toBe(c.top);
    expect(cragTopAt(crags, c.x, c.z, c.top - 3)).toBeNull(); // inside the rock, not on top
  });
});
```

`protocol.test.ts`: `decodeClient` accepts a `move` with `anim: 'climb'` and `'glide'`.

- [ ] **Step 2: Run** `npx vitest run src/shared` — FAIL.
- [ ] **Step 3: Implement**

```ts
// crags.ts
export interface Crag { id: number; x: number; z: number; r: number; base: number; top: number }
export const CRAG = { cell: 60, chance: 0.45, minH: 7, maxH: 14, minR: 2.4, maxR: 3.8, spawnClear: 30, maxDensity: 0.45 } as const;

/** One cell per 60 m, four rng draws per cell so a rule change can't reshuffle the map. */
export function generateCrags(terrain: Terrain, seed: number): Crag[] {
  const rng = createRng(seed ^ 0x5eedc2a6);
  const out: Crag[] = [];
  for (let cx = -HALF + CRAG.cell / 2; cx < HALF; cx += CRAG.cell)
    for (let cz = -HALF + CRAG.cell / 2; cz < HALF; cz += CRAG.cell) {
      const [a, b, c, d] = [rng(), rng(), rng(), rng()];
      if (a > CRAG.chance) continue;
      const x = cx + (b - 0.5) * CRAG.cell * 0.6, z = cz + (c - 0.5) * CRAG.cell * 0.6;
      if (Math.abs(x) > HALF - 20 || Math.abs(z) > HALF - 20 || Math.hypot(x, z) < CRAG.spawnClear) continue;
      if (terrain.density(x, z) > CRAG.maxDensity) continue; // clearings: few trees poking through
      const r = CRAG.minR + d * (CRAG.maxR - CRAG.minR);
      let lo = Infinity, hi = -Infinity;
      for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const h = terrain.heightAt(x + ox, z + oz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (lo < WATER_LEVEL + 0.5) continue;
      out.push({ id: out.length, x, z, r, base: lo - 0.5, top: hi + CRAG.minH + (a / CRAG.chance) * (CRAG.maxH - CRAG.minH) });
    }
  return out;
}
export const cragsNear = (crags, x, z, pad) => crags.filter((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);
/** The crag top under (x, z) if y is at or above it (within 0.6 m), else null. */
export function cragTopAt(crags, x, z, y): number | null { ... Math.hypot(...) < c.r && y >= c.top - 0.6 ... }
```

`protocol.ts`: `ANIMS = [..., 'climb', 'glide']`, `PROTOCOL_VERSION = 5`.

- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): climbable crags + climb/glide anims (protocol v5)`

---

### Task 2: Server move validation for climbing and gliding

**Files:**
- Modify: `src/shared/sim/world-sim.ts` (`crags` field, `onMove`)
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: `generateCrags`, `cragsNear` (Task 1)
- Produces: `WorldSim.crags: readonly Crag[]`, `CLIMB_PAD = 4`

- [ ] **Step 1: Failing tests**

```ts
describe('traversal moves', () => {
  it('accepts climbing up the side of a crag and standing on top', () => {
    const sim = setup('Ana');
    const c = sim.crags[0]!;
    const x = c.x + c.r + 0.45;
    put(sim, 'Ana', x, c.z);
    let y = sim.getPlayer('Ana')!.y;
    for (; y < c.top; y += 0.22) sim.handle('Ana', { t: 'move', x, y, z: c.z, yaw: 0, anim: 'climb' }), sim.step(0.1);
    sim.handle('Ana', { t: 'move', x: c.x, y: c.top, z: c.z, yaw: 0, anim: 'idle' });
    expect(sim.getPlayer('Ana')!.y).toBeCloseTo(c.top);
    expect(sim.snapshotFor('Ana')).toMatchObject({ self: { fix: false } });
  });

  it('accepts a glide that keeps going down, far from the crag', () => {
    // start on top of crag 0, then 40 moves of 0.7 m outward and 0.16 m down per tick → never fixed
  });

  it('rejects rising in mid-air away from any crag', () => {
    // put far from crags; move to ground + 6 → fix; from ground + 3, step up by 0.5 each tick → fixed once above ground + 4
  });
});
```

- [ ] **Step 2: Run** — FAIL (the climb gets fixed at `ground + 4`).
- [ ] **Step 3: Implement** in `onMove`

```ts
const ground = Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL - 0.9);
const crag = cragsNear(this.crags, m.x, m.z, CLIMB_PAD).reduce((t, c) => Math.max(t, c.top + 3), -Infinity);
// ponytail: above ground + 4 and off a crag you may only go down (falling or gliding). Hovering at constant height passes; fine for co-op.
const yOk = m.y > ground - 1 && (m.y < ground + 4 || m.y < crag || m.y <= p.y);
```

- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): server accepts climbing and gliding moves`

---

### Task 3: Client physics — stamina + climbing

**Files:**
- Modify: `src/client/movement.ts`
- Test: `src/client/movement.test.ts`

**Interfaces:**
- Produces: `Body.stamina`, `Body.tired`, `Body.climb: Crag | null`, `Body.gliding`, `Body.jumpHeld`; `STAMINA`, `CLIMB_SPEED`; `stepBody(..., crags: readonly Crag[] = [])`; `StepResult.climbing`, `StepResult.gliding`; `animFor` returns `'climb'`

- [ ] **Step 1: Failing tests**

```ts
const crag: Crag = { id: 0, x: 0, z: -3, r: 2, base: -1, top: 8 };
it('pushing into a crag grabs it and climbs up, spending stamina', () => {
  const { b, r } = run(fwd, 1, flat, none, 0, [crag]);
  expect(b.climb).toBe(crag);
  expect(b.y).toBeGreaterThan(1);
  expect(b.stamina).toBeLessThan(STAMINA.max);
  expect(animFor(r, b)).toBe('climb');
});
it('climbs over the top and stands on it', () => { /* 6 s → climb null, y = top, inside radius */ });
it('lets go when stamina runs out, and is tired until full', () => { /* stamina 5 → falls, tired, regen on ground */ });
it('jump leaps off the wall', () => { /* after grabbing, jump → climb null, moving away */ });
it('strafing circles the crag', () => { /* x = 1 → angle changes, distance to centre stays r + PLAYER_RADIUS */ });
it('is pushed out of a crag it is not climbing (tired)', () => {});
```

- [ ] **Step 2: Run** `npx vitest run src/client/movement.test.ts` — FAIL.
- [ ] **Step 3: Implement** — see `stepClimb` in the code: stick forward/back = up/down at `CLIMB_SPEED = 2.2`, strafe = around (angle `+= x · speed · dt / (r + PLAYER_RADIUS)`, facing = angle + π so "right" is the increasing angle). Drain `STAMINA.climbMove = 10`/s moving, `climbHold = 3`/s still. At the top: mantle to `c.r - 0.6` from the centre at `y = top`. At the foot: let go on the ground. Out of stamina: drop and set `tired` (no climb/glide/fast swim until the meter refills). Jump: `STAMINA.leap = 20`, launched 4 m/s outward and up. Grab rule on the ground path: touching a crag (collision push), below its top, not tired, input pointing at it (`dot > 0.5`). Standing on a crag top uses `cragTopAt` as the ground.
- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): climb marked crags with stamina`

---

### Task 4: Client physics — glider + fast swimming

**Files:**
- Modify: `src/client/movement.ts`, `src/client/movement.test.ts`

**Interfaces:**
- Produces: `GLIDE = { speed: 7, sink: 1.6, minHeight: 1.5 }`, `SPEED.swimFast = 4`, `STAMINA.glide = 4`, `STAMINA.swimFast = 12`; `animFor` returns `'glide'`

- [ ] **Step 1: Failing tests**

```ts
it('pressing jump again in the air opens the glider: slow sink, forward drift', () => {
  // body at y = 20 over flat, airborne; press jump (edge) → gliding; after 1 s: vy = -GLIDE.sink, speed ≈ GLIDE.speed
});
it('the glider closes on landing, on a second press, and when stamina runs out', () => {});
it('holding jump does not open the glider (needs a fresh press)', () => {});
it('sprint swimming is faster and costs stamina; tired swimmers are slow', () => {});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** — edge-detect jump with `jumpHeld`. In the air with a fresh press, `y - ground > GLIDE.minHeight`, not tired → `gliding`. While gliding: horizontal speed eases toward `GLIDE.speed` along the stick (or along `facing` if the stick is idle), `vy = -GLIDE.sink`, drain 4/s. A crag in the way can be grabbed from the glider. Swimming with sprint and not tired: `SPEED.swimFast`, drain 12/s. Regen `STAMINA.regen = 30`/s whenever on the ground (or swimming slowly) and not climbing/gliding.
- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): glider and fast swimming`

---

### Task 5: Client wiring — crag meshes, stamina ring, glider visual, help

**Files:**
- Create: `src/client/scene/crags.ts`
- Modify: `src/client/game.ts`, `src/client/hud.ts`, `src/client/style.css`, `src/client/actors/actor.ts`

No new unit tests (DOM/Three wiring). Verification is check, build and the in-browser check.

- [ ] **Step 1: `buildCrags(crags)`** — one stacked, slightly tapered grey cylinder per crag (base → top) plus a few dark-green vine strips (thin boxes) down its sides so they read as "you can climb this".
- [ ] **Step 2: game.ts** — `this.crags = generateCrags(terrain, seed)` in `buildWorld`, add the mesh; pass `this.crags` to `stepBody`; resources inside a crag radius are hidden and uncollided on the client (the server's spawn list is unchanged).
- [ ] **Step 3: Anims** — `PLAYER_CLIPS.climb = { clip: 'Punch', speed: 0.6 }`, `glide = { clip: 'Jump', speed: 0.4, once: true }`; a simple canopy mesh (flattened cone, cloth colour) on every player actor, visible only while its anim is `glide` (so teammates see it too).
- [ ] **Step 4: HUD** — `setStamina(frac, tired)`: a small ring next to the player's screen centre, hidden when full; red while tired.
- [ ] **Step 5: Help** — menu line: `Empuja contra un peñasco con enredadera para trepar · B/Espacio en el aire: planeador · B/Espacio trepando: saltar · Correr en el agua: nadar rápido`. Prompt when touching a crag while tired: `Sin aliento`.
- [ ] **Step 6: Verify** — `npm test && npm run test:workers && npm run check && npm run build`; local check with `npm run dev:server` + headless Chromium: find a crag, climb it, glide off.
- [ ] **Step 7: Commit** — `feat(aventura): crags, stamina ring and glider on the client`

---

### Task 6: Ship

- [ ] **Step 1:** `git push origin aventura/slice-1`.
- [ ] **Step 2:** Plan D section in `docs/superpowers/HANDOFF-aventura.md` (commits, tests, the climbing decision and why, what to playtest) and one short note on draft PR #2. No merge: merge to `main` deploys.

---

## Self-review notes

- **Spec coverage (§6):** climbing with stamina (fallback B, reasons recorded above), glider, swimming (it already existed: shallow `swim` at 2.2 m/s; this adds a stamina-gated fast swim). Rain blocking climbing (§9) is future weather work; the `Crag` list is the flag Enredadera will extend.
- **Trust:** the server still bounds speed per second. New height rules: near a crag up to its top + 3 m; elsewhere above `ground + 4` only downward. Stamina is client-side (ponytail, same as the roll dash). Hovering at constant height is possible for a cheater; acceptable for co-op.
- **Save compat:** nothing new is saved; crags come from the seed. `PROTOCOL_VERSION` 5 sends stale clients to the reload screen.
- **Types:** `Crag`, `CRAG`, `STAMINA`, `GLIDE`, `CLIMB_SPEED`, `Body.stamina/tired/climb/gliding/jumpHeld` used consistently in Tasks 1–5.
- **Known gaps:** raiders and wolves walk through crags (server has no crag collision); the camera can clip into a crag while climbing.
