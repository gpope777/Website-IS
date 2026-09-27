# Aventura F — La Raíz-madre: mazmorra, jefe de papel y defensor purificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A giant **Raíz-madre** stands in the world. Pressing A / E at its hollow takes you *inside*: a handmade three-room space far outside the map. A root gate opens with two levers; behind it an altar awakens **Enredadera**; in the last room waits **el Tragón de Papel**, the nephew's drawing (`public/enemies/enemy1.png`) as a living paper cutout. Its folded paper shrugs off blows until you **parry** it or **tangle it with Enredadera**; then it can be hurt. Beaten, it is **purified** and from then on guards the Corazón del Bosque, biting raiders during sieges.

**Architecture:** Same pattern as crags and shrines. `src/shared/dungeon.ts` holds the fixed interior layout, the seed-derived entrance, a terrain wrapper (`withDungeon`) that gives the interior a flat floor, and a movement clamp (walls + gate) that both client and server use. The interior is a rectangle at `x = HALF + 150` (outside the playable map): "instanced" here means a separate space in the same room/sim, entered by teleport. Server state: live-only gate/levers and the boss; saved `SavedWorld.purified?` and `SavedPlayer.enredadera?`. The boss is a `Wolf` record of kind `'boss'` with extra fields, stepped by `stepBoss` (`src/shared/sim/boss.ts`); it rides the existing `wolves` list in `snap`, so aim/lock-on/attack/bow work unchanged. The defender is a small `Ally` stepped by `stepAlly` (`src/shared/sim/ally.ts`). The client draws the boss and the defender with a **paper-cutout actor** (a textured plane that turns to the camera and bobs, sways and squashes) — no image-to-3D pipeline.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §2 (purified creatures defend the base), §4 (purified creatures defend), §5 (bosses are puzzles: weakened by parry and by the dungeon's power), §6 (Enredadera), §7 (one big instanced dungeon, entrance is a giant root-mother, inside is its own space; puzzles, the power and the boss), §12 (1 dungeon: Enredadera + drawing boss purified into a defender). Foundation: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`.

## Decisions (recorded)

1. **"Instanced" = a separate area in the same World DO**, not a separate DO. The interior is a 24 × 96 m rectangle at `x = HALF + 150`, far outside the map (the open-questions list in the spec allowed either). One interior per world, shared by everyone in it (co-op). Getting in/out is a server teleport. Simplest thing that keeps one sim, one save and one socket.
2. **Scope cut:** the spec asks for 30–45 min, 4–6 puzzles and a mini-boss. Slice F ships **one puzzle (two root levers → gate), the power altar and the boss**, in three rooms. More rooms plug into the same layout table later.
3. **Enredadera moves to the dungeon altar** (spec §7: the dungeon grants the power). One rule in `onPower`: `p.enredadera === true`. **Old saves keep their power:** on load, a player who already has any shrine orb and no `enredadera` field gets `enredadera = true`. The shrine orb no longer announces the power. The ledge shrine therefore comes after the dungeon.
4. **Boss = el Tragón de Papel** (`enemy1.png`, the purple chomper on wheels). User decision: a 2D paper cutout in the 3D world (billboard plane with bob/sway/squash). 300 HP, slow, telegraphed bite (0.7 s wind-up, then 24 damage in 3.2 m). **Folded paper:** blows and arrows do nothing unless it is *weak*. It becomes weak for 4 s after a parry, and for 5 s (and rooted, cannot move or bite) when an Enredadera cast lands within 4 m of it. Rolling dodges the bite like any other.
5. **Reset:** if nobody alive is in the boss room, the boss disappears and comes back at full HP next time. It never returns once purified.
6. **Purified defender:** `SavedWorld.purified = true` when the boss dies. While the world has a living Heart, a small, white Tragón ("el Tragón purificado") stays by it. During a raid it bites the nearest raider within 16 m of the Heart (25 damage, 1.2 s). It cannot die (simplest; add HP when invasions exist).
7. **Warm inside:** the interior counts as near a fire (no cold death while solving it).
8. **Touch:** no new pill. Enter, exit, levers and altar use the contextual A button (E on keyboard), like shrines. The power stays on H / 🌿.

## Global Constraints

- All player-facing text in **Spanish**, dry voice.
- **Phones first:** every new action has a key and a touch button (A / E contextual).
- **Trust boundary:** `{t:'dungeon', act}` goes through `decodeClient` (act 0..4). The server re-checks alive, reach, gate state, and move bounds/gate crossing.
- **Protocol:** new message `dungeon`, new `snap` fields `dungeon`/`ally`, new `SelfState.power`, `EnemyKind` gains `'boss'` → `PROTOCOL_VERSION` 6 → 7. `SavedWorld.purified` and `SavedPlayer.enredadera` are optional: old saves load.
- Run `npm test && npm run test:workers && npm run check && npm run build` before every commit.
- Commit messages end with the `Co-Authored-By` + `Claude-Session` trailer.

---

### Task 1: Dungeon layout (shared) and protocol v7

**Files:**
- Create: `src/shared/dungeon.ts`, `src/shared/dungeon.test.ts`
- Modify: `src/shared/protocol.ts`, `src/shared/protocol.test.ts`, `src/shared/sim/wolves.ts` (`ENEMY.boss`, labels)

**Interfaces:**
- Produces: `DUNGEON`, `inDungeon(x, z, pad?)`, `inBossRoom(x, z)`, `leverPos(i)`, `withDungeon(t): Terrain`, `clampStep(px, pz, nx, nz, gateOpen)`, `generateEntrance(terrain, seed, crags, shrines): { x; y; z }`
- Produces: `EnemyKind` + `'boss'`, `DungeonView`, `AllyView`, snap `dungeon`, `ally`; `SelfState.power`; ClientMsg `{t:'dungeon'; act}`; `PROTOCOL_VERSION = 7`

- [ ] **Step 1: Failing tests**

```ts
// dungeon.test.ts
import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateCrags } from './crags';
import { generateShrines } from './shrines';
import { clampStep, DUNGEON, generateEntrance, inDungeon, withDungeon } from './dungeon';

describe('dungeon', () => {
  it('the interior lies outside the map and has a flat floor', () => {
    const t = withDungeon(createTerrain(1));
    expect(DUNGEON.x - DUNGEON.halfW).toBeGreaterThan(HALF + 50);
    expect(t.heightAt(DUNGEON.x, 40)).toBe(DUNGEON.floor);
    expect(t.heightAt(DUNGEON.x + DUNGEON.halfW + DUNGEON.pad - 1, 40)).toBe(DUNGEON.floor);
    expect(t.heightAt(0, 0)).toBe(createTerrain(1).heightAt(0, 0));
    expect(inDungeon(DUNGEON.x, 50)).toBe(true);
    expect(inDungeon(0, 0)).toBe(false);
  });
  it('walls and the closed gate stop you; the open gate lets you through', () => {
    const X = DUNGEON.x;
    expect(clampStep(X, 10, X + 50, 10, false).x).toBeCloseTo(X + DUNGEON.halfW - 0.5);
    expect(clampStep(X, 10, X, -5, false).z).toBeCloseTo(DUNGEON.z0 + 0.5);
    expect(clampStep(X, DUNGEON.gateZ - 1, X, DUNGEON.gateZ + 1, false).z).toBeCloseTo(DUNGEON.gateZ - 0.5);
    expect(clampStep(X, DUNGEON.gateZ - 1, X, DUNGEON.gateZ + 1, true).z).toBe(DUNGEON.gateZ + 1);
    expect(clampStep(0, 0, HALF + 5, 0, false).x).toBe(HALF - 3);
  });
  for (const seed of [1, 7, 42, 1234]) {
    it(`places the Raíz-madre on dry land away from crags and shrines (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const crags = generateCrags(t, seed);
      const shrines = generateShrines(t, seed, crags);
      const e = generateEntrance(t, seed, crags, shrines);
      expect(e).toEqual(generateEntrance(t, seed, crags, shrines));
      expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(DUNGEON.minDist - 1e-6);
      expect(t.heightAt(e.x, e.z)).toBeGreaterThan(WATER_LEVEL);
      for (const c of crags) expect(Math.hypot(c.x - e.x, c.z - e.z)).toBeGreaterThan(DUNGEON.clear);
      for (const s of shrines) expect(Math.hypot(s.x - e.x, s.z - e.z)).toBeGreaterThan(DUNGEON.clear);
    });
  }
});
```

`protocol.test.ts`: `decodeClient` accepts `{t:'dungeon',act:0}` and `act:4`; rejects `act:5`, `act:-1`, `act:1.5`, missing `act`.

- [ ] **Step 2: Run, see red.** `npx vitest run src/shared`

- [ ] **Step 3: Implement**

```ts
// dungeon.ts
export const DUNGEON = {
  x: HALF + 150, z0: 0, z1: 96, halfW: 12, floor: 30, pad: 10,
  entryZ: 5, exitReach: 2.5, gateZ: 32,
  levers: [{ x: -9, z: 22 }, { x: 9, z: 22 }], leverReach: 2.5, leverWindow: 6,
  altarZ: 46, altarReach: 2.5, bossRoomZ: 60, bossZ: 80,
  enterReach: 5, minDist: 90, maxDist: 150, clear: 16, trunkR: 4,
} as const;

export function inDungeon(x: number, z: number, pad = 0): boolean {
  return Math.abs(x - DUNGEON.x) <= DUNGEON.halfW + pad && z >= DUNGEON.z0 - pad && z <= DUNGEON.z1 + pad;
}
export const inBossRoom = (x: number, z: number) => inDungeon(x, z) && z >= DUNGEON.bossRoomZ;
export const leverPos = (i: number) => ({ x: DUNGEON.x + DUNGEON.levers[i]!.x, z: DUNGEON.levers[i]!.z });

export function withDungeon(base: Terrain): Terrain {
  return { heightAt: (x, z) => (inDungeon(x, z, DUNGEON.pad) ? DUNGEON.floor : base.heightAt(x, z)), density: (x, z) => base.density(x, z) };
}

/** Where a step from (px,pz) toward (nx,nz) ends: interior walls and the closed gate inside, the map edge outside. */
export function clampStep(px: number, pz: number, nx: number, nz: number, gateOpen: boolean): { x: number; z: number } {
  if (!inDungeon(px, pz, 2)) return { x: clamp(nx, -HALF + 3, HALF - 3), z: clamp(nz, -HALF + 3, HALF - 3) };
  const x = clamp(nx, DUNGEON.x - DUNGEON.halfW + 0.5, DUNGEON.x + DUNGEON.halfW - 0.5);
  let z = clamp(nz, DUNGEON.z0 + 0.5, DUNGEON.z1 - 0.5);
  if (!gateOpen && pz < DUNGEON.gateZ && z > DUNGEON.gateZ - 0.5) z = DUNGEON.gateZ - 0.5;
  return { x, z };
}
```

`generateEntrance`: `createRng(seed ^ 0x2007d00d)`, up to 120 tries at a random angle and `minDist..maxDist`; accept a dry spot (`> WATER_LEVEL + 0.5` at the centre and 4 points at `trunkR`) inside `HALF - 25`, farther than `clear` from every crag and shrine. Fallback: the last candidate.

Protocol:

```ts
export type EnemyKind = 'wolf' | 'brute' | 'boss';
/** Live dungeon state: gate, levers pulled, whether the boss was purified, the boss bar. */
export interface DungeonView { gate: boolean; levers: boolean[]; purified: boolean; boss: { hp: number; max: number; weak: boolean } | null }
export interface AllyView { x: number; y: number; z: number; yaw: number; anim: WolfAnim }
// SelfState += power: boolean   (has Enredadera)
// ClientMsg += { t: 'dungeon'; act: number }  // 0 enter, 1 exit, 2/3 lever, 4 altar
// snap += dungeon: DungeonView; ally: AllyView | null
case 'dungeon':
  return id(m.act) && (m.act as number) <= 4 ? { t: 'dungeon', act: m.act as number } : null;
```

`wolves.ts`: `ENEMY.boss = { hp: 300, run: 2.8, damage: 24, reach: 3.2, biteCooldown: 2.2 }`, `ENEMY_LABELS.boss = 'el Tragón de Papel'`. `world-sim.ts` gets the minimum to compile: `selfState.power = !!p.enredadera`, snap `dungeon: { gate: false, levers: [false, false], purified: false, boss: null }`, `ally: null`, and ignores `dungeon` messages (real handling in Task 2).

- [ ] **Step 4: Green.** `npm test && npm run test:workers && npm run check && npm run build`
- [ ] **Step 5: Commit + push** `feat(aventura): dungeon layout, entrance and protocol v7`

---

### Task 2: Entering, the root gate and the Enredadera altar (server)

**Files:**
- Modify: `src/shared/sim/world-sim.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `WorldSim.entrance`, `WorldSim.terrain` wraps `withDungeon`; `SavedPlayer.enredadera?: boolean`; `onDungeon(p, l, act)`; `onPower` checks `p.enredadera`; `dungeonView()`.

- [ ] **Step 1: Failing tests** (new `describe('dungeon')` in `world-sim.test.ts`)

```ts
describe('dungeon', () => {
  const act = (sim: WorldSim, name: string, a: number) => sim.handle(name, { t: 'dungeon', act: a });
  const enter = (sim: WorldSim, name: string) => { put(sim, name, sim.entrance.x + DUNGEON.trunkR + 1, sim.entrance.z); act(sim, name, 0); };

  it('the hollow takes you inside and the exit brings you back', () => {
    const sim = setup('Ana');
    act(sim, 'Ana', 0); // too far from the root
    expect(inDungeon(sim.getPlayer('Ana')!.x, sim.getPlayer('Ana')!.z)).toBe(false);
    enter(sim, 'Ana');
    const p = sim.getPlayer('Ana')!;
    expect(inDungeon(p.x, p.z)).toBe(true);
    expect(p.y).toBe(DUNGEON.floor);
    expect(snap(sim, 'Ana').self.fix).toBe(true);
    // walking inside is accepted; walking out through the wall is not
    sim.handle('Ana', { t: 'move', x: p.x + 0.5, y: DUNGEON.floor, z: p.z, yaw: 0, anim: 'walk' });
    expect(snap(sim, 'Ana').self.fix).toBe(false);
    act(sim, 'Ana', 1);
    expect(Math.hypot(p.x - sim.entrance.x, p.z - sim.entrance.z)).toBeLessThan(10);
  });

  it('the gate stays shut until both root levers are pulled in time, then the altar gives Enredadera', () => {
    const sim = setup('Ana');
    enter(sim, 'Ana');
    const p = sim.getPlayer('Ana')!;
    sim.handle('Ana', { t: 'move', x: p.x, y: p.y, z: DUNGEON.gateZ + 1, yaw: 0, anim: 'run' }); // not a real step, and through the gate
    expect(p.z).toBeLessThan(DUNGEON.gateZ);
    for (const i of [0, 1]) { const l = leverPos(i); put(sim, 'Ana', l.x, l.z); act(sim, 'Ana', 2 + i); }
    expect(snap(sim, 'Ana').dungeon).toMatchObject({ gate: true, levers: [true, true] });
    put(sim, 'Ana', DUNGEON.x, DUNGEON.altarZ);
    act(sim, 'Ana', 4);
    expect(snap(sim, 'Ana').self.power).toBe(true);
    expect(sim.save().players[0]!.enredadera).toBe(true);
  });

  it('levers too far apart in time do not open it', ...);
  it('shrine orbs alone no longer give the power; old saves with orbs keep it', ...);
  it('the dead cannot use it; the interior is warm at night', ...);
});
```

Plan E tests change with the rule: the `caster` helper sets `enredadera = true`; "needs a cleared shrine" becomes "needs the altar" (a shrine orb is not enough); the levers test asserts the orb toast no longer mentions Enredadera.

- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement** in `WorldSim`:

```ts
this.terrain = withDungeon(createTerrain(saved.seed));
this.entrance = generateEntrance(this.terrain, saved.seed, this.crags, this.shrines);
for (const p of this.players.values()) if (p.enredadera === undefined && (p.shrines ?? []).length) p.enredadera = true; // decision 3
private dungeonLive = { pulled: [null, null] as (number | null)[], gate: false };

private onDungeon(p: SavedPlayer, l: Live, act: number): void {
  if (p.dead) return;
  const near = (x: number, z: number, r: number) => Math.hypot(x - p.x, z - p.z) <= r;
  if (act === 0) {
    if (!near(this.entrance.x, this.entrance.z, DUNGEON.trunkR + DUNGEON.enterReach)) return;
    this.teleport(p, l, DUNGEON.x, DUNGEON.entryZ + 1.5);
    return this.tell(p.name, 'Dentro de la Raíz-madre. Huele a papel viejo');
  }
  if (!inDungeon(p.x, p.z)) return;
  if (act === 1) { if (near(DUNGEON.x, DUNGEON.entryZ, DUNGEON.exitReach)) this.teleport(p, l, ...this.outside()); return; }
  if (act === 2 || act === 3) { /* pull; both within leverWindow → gate = true, say */ }
  if (act === 4) { /* near altar, not already → p.enredadera = true, tell */ }
}
```

`teleport` sets x/z/y, `fix`, and resets the move anchor. `outside()` = 6 m from the trunk toward spawn. `onMove`: `inBounds` also accepts the interior; a move that crosses `gateZ` inside while the gate is shut is rejected. `nearFire` returns true inside. `onPower` checks `p.enredadera`.

- [ ] **Step 4: Green** (full suite).
- [ ] **Step 5: Commit + push** `feat(aventura): Raíz-madre dungeon: entrance, root gate, Enredadera altar`

---

### Task 3: El Tragón de Papel (server)

**Files:**
- Create: `src/shared/sim/boss.ts`, `src/shared/sim/boss.test.ts`
- Modify: `src/shared/sim/world-sim.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces: `BOSS`, `Boss extends Wolf { weak; rooted; windup }`, `createBoss()`, `stepBoss(b, targets, dt): string | null`; `SavedWorld.purified?`; `WorldSim.purified`.

- [ ] **Step 1: Failing tests**

```ts
// boss.test.ts
describe('stepBoss', () => {
  const t = (x: number, z: number) => ({ name: 'Ana', x, z, dead: false, fires: false });
  it('walks up, winds up, then bites if you are still there', () => {
    const b = createBoss();
    for (let i = 0; i < 5; i++) stepBoss(b, [t(DUNGEON.x, BOSS_Z - 10)], 0.1);
    expect(b.z).toBeLessThan(BOSS_Z); expect(b.anim).toBe('run');
    const near = [t(b.x, b.z - 2)];
    expect(stepBoss(b, near, 0.1)).toBeNull(); // wind-up starts
    let bit: string | null = null;
    for (let i = 0; i < 8 && !bit; i++) bit = stepBoss(b, near, 0.1);
    expect(bit).toBe('Ana');
  });
  it('a rooted boss neither moves nor bites', ...);
  it('stays inside the boss room', ...);
});
```

World-sim (`describe('boss')`): enters the room → boss appears in `wolves` with kind `'boss'` and `dungeon.boss` bar; punches and arrows do nothing while folded (toast "El papel doblado aguanta…"); a parried bite makes it weak and punches then hurt; an Enredadera cast next to it roots it and makes it weak; leaving the room resets it; killing it sets `purified` (saved, survives load) and it never comes back; old saves without `purified` load.

- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement**

```ts
export const BOSS = { id: 0, windup: 0.7, weakFor: 4, rootFor: 5, rootRadius: 4, corpseTime: 4 } as const;
export interface Boss extends Wolf { weak: number; rooted: number; windup: number }
export function createBoss(): Boss { /* Wolf record, kind 'boss', at (DUNGEON.x, DUNGEON.bossZ), y floor */ }
export function stepBoss(b: Boss, targets: WolfTarget[], dt: number): string | null {
  // dead → deadFor; tick weak/cooldown; rooted or stunned → idle, no wind-up;
  // chase the nearest live target; in reach → wind-up (anim 'attack'); wind-up ends → bite if within reach + 1.
  // movement clamped to the boss room.
}
```

`WorldSim`: `boss: Boss | null`, `purified` (saved). `stepBossFight(dt)` spawns it when a live player is in the room (announces the rule), removes it when the room is empty (reset), bites through `bite()`, marks `purified` on death. `enemy(id)` finds wolves or the boss for `onAttack`/`onShoot`. A `strike(p, w, dmg)` helper refuses damage to a folded boss. `bite()` parry on the boss sets `weak = BOSS.weakFor`. `onPower` roots the boss if the vine lands within `rootRadius`. Kill toasts read "derrotó al Tragón de Papel" (`a el` → `al`).

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit + push** `feat(aventura): el Tragón de Papel, a boss beaten by parry and Enredadera`

---

### Task 4: The purified defender (server)

**Files:**
- Create: `src/shared/sim/ally.ts`, `src/shared/sim/ally.test.ts`
- Modify: `src/shared/sim/world-sim.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces: `ALLY`, `Ally`, `createAlly(heart, terrain)`, `stepAlly(a, home, foes, terrain, dt): Wolf | null`; snap `ally`.

- [ ] **Step 1: Failing tests**

```ts
describe('stepAlly', () => {
  it('runs to the nearest raider near the Heart and bites it on a cooldown', ...);
  it('ignores raiders far from the Heart and plain wolves; goes home when idle', ...);
});
```

World-sim: no ally without `purified` or without a living Heart; with both, `snap.ally` is set for everyone; during an active raid the ally hurts a raider next to the Heart.

- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement**

```ts
export const ALLY = { guard: 16, run: 5.5, reach: 2.2, damage: 25, cooldown: 1.2, home: 2.5 } as const;
export interface Ally { x: number; y: number; z: number; yaw: number; cooldown: number; anim: WolfAnim }
export function stepAlly(a: Ally, heart: { x: number; z: number }, foes: readonly Wolf[], terrain: Terrain, dt: number): Wolf | null {
  // nearest living raid foe within ALLY.guard of the Heart; run to it; in reach and cooled down → return it (caller hits).
  // none → walk back to (heart.x + home, heart.z), then idle.
}
```

`WorldSim.step`: `if (purified && heart alive) ally ??= createAlly(...); stepAlly → hitWolf(foe, ALLY.damage)`; otherwise `ally = null`.

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit + push** `feat(aventura): the purified Tragón guards the Heart during raids`

---

### Task 5: Client rules — interior terrain, walls, contextual actions

**Files:**
- Create: `src/client/dungeon-ui.ts`, `src/client/dungeon-ui.test.ts`
- Modify: `src/client/movement.ts` (+ test: optional `bounds` param), `src/client/game.ts` (terrain wrapper, clamp, act/prompt, power flag)

**Interfaces:**
- Produces: `dungeonAction(pos, entrance, view, power): { act: number; label: string } | null`, `bossBarText(view)`; `stepBody(..., crags, bounds?)`.

- [ ] **Step 1: Failing tests**

```ts
describe('dungeonAction', () => {
  it('offers entering at the root, exiting at the door, levers, and the altar only without the power', ...);
  it('nothing in the open', ...);
});
// movement.test.ts
it('a custom bounds function clamps the step (dungeon walls)', ...);
```

- [ ] **Step 2: Red.**
- [ ] **Step 3: Implement.** `stepBody` takes `bounds: Bounds = mapBounds` and uses it instead of the `HALF` clamp. `Game` builds `withDungeon(createTerrain(seed))`, passes `(px,pz,nx,nz) => clampStep(px,pz,nx,nz,gateOpen)`, stores `self.power`, tries `dungeonAction` in `act()` right after shrine parts and shows its label as the desktop prompt (`E · …`). The bare-rock prompt uses `power` instead of the orb count.
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit + push** `feat(aventura): client rules for the dungeon: floor, walls, contextual actions`

---

### Task 6: Client visuals — the Raíz-madre, the interior and paper cutouts

**Files:**
- Create: `src/client/scene/dungeon.ts`, `src/client/actors/paper.ts`
- Modify: `src/client/game.ts`, `src/client/hud.ts` (boss bar), `src/client/style.css` if needed

- [ ] **Step 1:** `PaperActor` (same surface as `Actor`: `root`, `setPose`, `play`, `update`, `dispose`): a `PlaneGeometry` with `enemy1.png` (`alphaTest 0.5`, `DoubleSide`), height 4.5 m for the boss / 1.4 m for the ally; each frame it yaws to face the camera (cylindrical billboard), bobs (`sin`), sways (`rotation.z`), squashes/stretches, crouches on `attack`, falls flat on `dead`; `setTint(color)` (weak = blue-grey, ally = white-green).
- [ ] **Step 2:** `DungeonMeshes`: the Raíz-madre in the world (a huge trunk, roots, a glowing hollow, a violet beam), and the interior (floor, walls, gate of roots hidden when open, two root levers, altar orb hidden once you have the power, exit ring). `sync(view, power)`, `animate(t)`.
- [ ] **Step 3:** `Game`: boss rides the wolves map with a `PaperActor`; ally uses its own `PaperActor`; `hud.setBoss(bossBarText(...))` shows "Tragón de Papel" HP (and "doblado" / "¡expuesto!").
- [ ] **Step 4:** `npm test && npm run test:workers && npm run check && npm run build`. Optional local check with `npm run dev:server` + headless Chromium.
- [ ] **Step 5: Commit + push** `feat(aventura): the Raíz-madre, its interior and the paper boss on the client`

---

### Task 7: Ship

- [ ] Append "## Plan F" to `docs/superpowers/HANDOFF-aventura.md` (Spanish): commits, test counts, decisions, blockers, what to test in-game.
- [ ] Commit + `git push origin aventura/slice-1`.
- [ ] One short comment on PR #2 (gpope777/Website-IS). **Do not merge** (merge = deploy).

## Self-review notes

- Spec coverage: instanced dungeon with root-mother entrance (§7) ✓, puzzle ✓ (1 of 4–6, recorded cut), power from the dungeon ✓, drawing boss ✓, boss weakened by parry and by the power (§5) ✓, purified into a base defender (§2, §12) ✓. Mini-boss: cut (recorded).
- Type consistency: `DungeonView.levers` is always length 2; `act` 0..4 everywhere; `BOSS.id = 0` never collides with wolves (ids start at 1).
- Risks: the interior's walls are only a clamp (no mesh collision needed); the camera may peek past a wall (floor extends `pad` metres so it never drops under the overworld rim). Overworld wolves cannot reach the interior (they clamp to the map).
