# Aventura B — Combate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fighting stops being "press E next to a fox". Players can roll through a bite, raise a guard (and parry a bite with good timing, which stuns the beast), shoot a bow that softly aims itself at the best target in front, and lock on to one enemy. Enemies become a small data-driven family: the old wolf plus a slow, heavy **bruto marchito** that joins raids from siege level 1.

**Architecture:** All rules stay in `src/shared` (pure TS, vitest). A generic enemy table (`ENEMY`) in `sim/wolves.ts` drives stats per `EnemyKind`; the existing `Wolf` record gains `kind` and `stun`. A new `sim/combat.ts` holds the tuning constants and the pure `resolveHit` / `inCone` rules. `WorldSim` owns the per-player guard state (roll i-frames, block start) and validates `roll`, `block` and `shoot`. Aiming and lock-on are client-side choices (`src/client/aim.ts`); the server re-checks range, cone, cooldown and alive state, so the trust boundary does not move. Roll movement is client-side physics, like walking, within the existing speed check.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` section 5 ("Combat, option C") and 12. Foundation: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`. Plan map: top of `2026-09-26-aventura-A-corazon-asedios.md` (this is Plan B).

## Global Constraints

- All player-facing text in **Spanish**, dry and short.
- **Phones first:** every new action has a key and a touch button (`src/client/touch.ts` `PILL_BUTTONS`). Block is a *held* button (`hold: 'block'`).
- **Keys:** `Q` rodar, `Z` (held) bloquear, `R` arco, `X` fijar objetivo. (Tab was rejected: the browser moves focus.)
- **Trust boundary:** new client messages (`roll`, `block`, `shoot`) go through `decodeClient`. The server checks alive state, cooldowns, range and facing cone for everything.
- **Protocol:** `PROTOCOL_VERSION` goes 2 → 3. `SavedWorld.version` stays `1`; nothing combat-related is saved (guard state is live-only, enemies are never saved), so old saves load unchanged.
- **Out of scope (recorded):** the active *power* (spec §5) arrives with Plan E (Enredadera). Weapon upgrades arrive with progression. The bow has **no ammo** (simplest reading of the spec; add arrows as an item only if playtest shows bow spam). Right-click-to-block on desktop is not added (Z only).
- Run `npm test`, `npm run test:workers`, `npm run check` and `npm run build` before every commit.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LAtHShjMw8Viwtk2XHSyPs
  ```

---

### Task 1: Generic enemy type + protocol v3

**Files:**
- Modify: `src/shared/protocol.ts`
- Modify: `src/shared/sim/wolves.ts`
- Modify: `src/shared/sim/world-sim.ts` (snapshot `kind`, brutes in raids, kind-aware damage/labels)
- Test: `src/shared/protocol.test.ts`, `src/shared/sim/wolves.test.ts`, `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces:
  - `EnemyKind = 'wolf' | 'brute'` (in `protocol.ts`, re-exported by `wolves.ts`)
  - `ENEMY: Record<EnemyKind, { hp; run; damage; reach; biteCooldown }>`, `ENEMY_LABELS: Record<EnemyKind, string>`
  - `Wolf.kind: EnemyKind`, `Wolf.stun: number` (seconds left); `createWolf(id, x, z, terrain, rng, kind = 'wolf')`
  - `raiderDamage(w: Wolf): number`
  - `WolfView.kind: EnemyKind`
  - `ANIMS` gains `'roll' | 'block' | 'bow'`
  - `ClientMsg` gains `{ t: 'roll' }`, `{ t: 'block'; on: boolean }`, `{ t: 'shoot'; id: number }`
  - `PROTOCOL_VERSION = 3`

- [ ] **Step 1: Write failing tests**

`src/shared/protocol.test.ts`: change the version test to `expect(PROTOCOL_VERSION).toBe(3)` and add:

```ts
describe('combat protocol', () => {
  it('decodes roll, block and shoot', () => {
    expect(decodeClient('{"t":"roll"}')).toEqual({ t: 'roll' });
    expect(decodeClient('{"t":"block","on":true}')).toEqual({ t: 'block', on: true });
    expect(decodeClient('{"t":"block","on":"yes"}')).toBeNull();
    expect(decodeClient('{"t":"shoot","id":4}')).toEqual({ t: 'shoot', id: 4 });
    expect(decodeClient('{"t":"shoot","id":1.5}')).toBeNull();
  });
  it('accepts the new anims', () => {
    for (const anim of ['roll', 'block', 'bow']) {
      expect(decodeClient(JSON.stringify({ t: 'move', x: 0, y: 0, z: 0, yaw: 0, anim }))).not.toBeNull();
    }
  });
});
```

`src/shared/sim/wolves.test.ts`:

```ts
describe('enemy kinds', () => {
  it('brutes are tougher and slower than wolves', () => {
    const b = createWolf(2, 0, 0, flat, rng, 'brute');
    expect(b.kind).toBe('brute');
    expect(b.hp).toBe(ENEMY.brute.hp);
    expect(ENEMY.brute.hp).toBeGreaterThan(ENEMY.wolf.hp);
    stepWolf(b, [target(10)], flat, 0.1, rng);
    expect(b.x).toBeCloseTo(ENEMY.brute.run * 0.1);
    expect(raiderDamage(b)).toBe(ENEMY.brute.damage);
    expect(raiderDamage(createWolf(3, 0, 0, flat, rng))).toBe(RAID.damage);
  });
  it('a stunned enemy neither moves nor bites', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    w.stun = 0.5;
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBeNull();
    expect(w.x).toBe(0);
    expect(w.stun).toBeCloseTo(0.4);
    for (let i = 0; i < 5; i++) stepWolf(w, [target(1)], flat, 0.1, rng);
    expect(w.stun).toBe(0);
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBe('Ana');
  });
});
```

(`flat`, `rng`, `target` are the file's existing helpers.)

`src/shared/sim/world-sim.test.ts`:

```ts
it('brutes join raids from siege level 1 and show their kind', () => {
  const sim = setup('Ana');
  plantHeart(sim);
  sim.raidLevel = 1;
  stepTo(sim, 0.81);
  const raiders = sim.wolfList.filter((w) => w.raid);
  expect(raiders.some((w) => w.kind === 'brute')).toBe(true);
  put(sim, 'Ana', raiders[0]!.x, raiders[0]!.z);
  expect(snap(sim, 'Ana').wolves[0]).toHaveProperty('kind');
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/shared` → FAIL (version 2, `roll` null, `ENEMY` undefined).

- [ ] **Step 3: Implement `protocol.ts`**

```ts
export const PROTOCOL_VERSION = 3;
export const ANIMS = ['idle', 'walk', 'run', 'jump', 'swim', 'attack', 'roll', 'block', 'bow'] as const;
export type EnemyKind = 'wolf' | 'brute';
export interface WolfView { id: number; kind: EnemyKind; x: number; y: number; z: number; yaw: number; anim: WolfAnim; raid: boolean }
// ClientMsg:
  | { t: 'roll' }
  | { t: 'block'; on: boolean }
  | { t: 'shoot'; id: number };
// decodeClient:
    case 'roll':
      return { t: 'roll' };
    case 'block':
      return typeof m.on === 'boolean' ? { t: 'block', on: m.on } : null;
    case 'shoot':
      return id(m.id) ? { t: 'shoot', id: m.id } : null;
```

- [ ] **Step 4: Implement `wolves.ts`**

```ts
export type { EnemyKind } from '../protocol';
export interface EnemyDef { hp: number; run: number; damage: number; reach: number; biteCooldown: number }
export const ENEMY: Record<EnemyKind, EnemyDef> = {
  wolf: { hp: WOLF.hp, run: WOLF.run, damage: WOLF.damage, reach: WOLF.reach, biteCooldown: WOLF.biteCooldown },
  brute: { hp: 140, run: 4.2, damage: 22, reach: 2.2, biteCooldown: 2 },
};
export const ENEMY_LABELS: Record<EnemyKind, string> = { wolf: 'un lobo', brute: 'un bruto marchito' };
```

`Wolf` gains `kind` and `stun`; `createWolf(..., kind: EnemyKind = 'wolf')` sets `hp: ENEMY[kind].hp, kind, stun: 0`. In `stepWolf`, right after the dead check:

```ts
  if (w.stun > 0) {
    w.stun = Math.max(0, w.stun - dt);
    w.anim = 'idle';
    return null;
  }
  const def = ENEMY[w.kind];
```

and replace `WOLF.run / WOLF.reach / WOLF.biteCooldown` in the chase/bite branch with `def.run / def.reach / def.biteCooldown` (wander speed and the `anim` run threshold use `def.run` too). `stepRaider` does the same stun check after its dead check, and marches at `ENEMY[w.kind].run`. Add:

```ts
/** Raiders hit players and structures with the raid damage; brutes always hit harder. */
export function raiderDamage(w: Wolf): number {
  return w.kind === 'brute' ? ENEMY.brute.damage : RAID.damage;
}
```

- [ ] **Step 5: Implement `world-sim.ts`**
  - Snapshot: `kind: w.kind` in each `WolfView`.
  - `spawnRaiders`: `const kind: EnemyKind = this.raidLevel >= 1 && i % 3 === 2 ? 'brute' : 'wolf';` passed to `createWolf`.
  - Raider hits use `raiderDamage(w)`; wild wolf bites use `ENEMY[w.kind].damage`.
  - The melee kill toast becomes `` `${p.name} derrotó a ${ENEMY_LABELS[w.kind]}` ``.

- [ ] **Step 6: Run everything** — `npm test && npm run test:workers && npm run check` → PASS (worker helpers already use `PROTOCOL_VERSION`).

- [ ] **Step 7: Commit** — `feat(aventura): generic enemy kinds (wolf, bruto marchito) + protocol v3`

---

### Task 2: Server combat — roll, block/parry, bow

**Files:**
- Create: `src/shared/sim/combat.ts`, `src/shared/sim/combat.test.ts`
- Modify: `src/shared/sim/world-sim.ts`
- Test: `src/shared/sim/world-sim.test.ts`

**Interfaces:**
- Produces:
  - `ROLL = { iframes: 0.35, cooldown: 0.8 }`, `BLOCK = { reduce: 0.8, parryWindow: 0.25, rearm: 0.6, parryStun: 1.5, parryDamage: 15 }`, `BOW = { damage: 15, range: 24, cooldown: 0.9, cone: Math.PI / 3 }`
  - `Guard = { rollUntil: number; rollReadyAt: number; blockSince: number | null; blockReadyAt: number; bowReadyAt: number }`, `newGuard()`
  - `HitOutcome = { kind: 'dodged' } | { kind: 'parried' } | { kind: 'blocked'; dmg: number } | { kind: 'hit'; dmg: number }`
  - `resolveHit(g: Guard, now: number, dmg: number): HitOutcome`
  - `inCone(x, z, yaw, tx, tz, cone): boolean` (protocol yaw: direction = (sin yaw, cos yaw))
- Consumes: `Wolf.stun`, `ENEMY`, `ENEMY_LABELS` (Task 1).

- [ ] **Step 1: Write failing tests**

`src/shared/sim/combat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BLOCK, inCone, newGuard, resolveHit } from './combat';

describe('resolveHit', () => {
  it('rolling dodges, a fresh guard parries, an old guard blocks', () => {
    const g = newGuard();
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'hit', dmg: 10 });
    g.rollUntil = 5.2;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'dodged' });
    g.rollUntil = 0;
    g.blockSince = 5 - BLOCK.parryWindow / 2;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'parried' });
    g.blockSince = 4;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'blocked', dmg: expect.closeTo(2) });
  });
});

describe('inCone', () => {
  it('uses protocol yaw (0 = +z)', () => {
    expect(inCone(0, 0, 0, 0, 5, 0.5)).toBe(true);
    expect(inCone(0, 0, 0, 0, -5, 0.5)).toBe(false);
    expect(inCone(0, 0, Math.PI / 2, 5, 0, 0.5)).toBe(true);
    expect(inCone(0, 0, Math.PI - 0.1, 0, -5, 0.5)).toBe(true); // wraps around ±π
  });
});
```

`src/shared/sim/world-sim.test.ts` (a helper to park one wolf next to Ana):

```ts
function wolfAt(sim: WorldSim, dx: number, dz = 0) {
  sim.time = DAY_LENGTH * 0.85;
  sim.step(0.1);
  const w = sim.wolfList[0]!;
  const p = sim.getPlayer('Ana')!;
  w.x = p.x + dx;
  w.z = p.z + dz;
  return w;
}

describe('combat', () => {
  it('rolling through a bite takes no damage, then goes on cooldown', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    sim.handle('Ana', { t: 'roll' });
    sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBe(100);
    expect(w.cooldown).toBeGreaterThan(0); // it did bite
  });

  it('a well-timed guard parries: no damage, the wolf is stunned and hurt', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    sim.handle('Ana', { t: 'block', on: true });
    sim.step(0.1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBe(100);
    expect(w.stun).toBeGreaterThan(1);
    expect(w.hp).toBe(ENEMY.wolf.hp - BLOCK.parryDamage);
    expect(sim.drain().some((o) => o.to === 'Ana' && o.msg.t === 'toast' && o.msg.text === 'Parada')).toBe(true);
  });

  it('a held guard only blocks most of the damage; spamming it does not re-arm the parry', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 50); // far away while Ana raises her guard
    sim.handle('Ana', { t: 'block', on: true });
    sim.handle('Ana', { t: 'block', on: false });
    sim.handle('Ana', { t: 'block', on: true }); // re-raised within rearm: no fresh parry window
    const p = sim.getPlayer('Ana')!;
    w.x = p.x + 1;
    w.z = p.z;
    sim.step(0.1);
    expect(p.vitals.health).toBeCloseTo(100 - ENEMY.wolf.damage * (1 - BLOCK.reduce));
    expect(w.stun).toBe(0);
  });

  it('shoots what is in front and in range, with a cooldown', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 0, 10); // yaw 0 faces +z
    sim.handle('Ana', { t: 'shoot', id: w.id });
    sim.handle('Ana', { t: 'shoot', id: w.id }); // cooldown
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
    sim.time += 1;
    sim.getPlayer('Ana')!.yaw = Math.PI; // turned away
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
    sim.getPlayer('Ana')!.yaw = 0;
    w.z = sim.getPlayer('Ana')!.z + BOW.range + 2; // too far
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp - BOW.damage);
  });

  it('dead players cannot roll, block or shoot', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 0, 5);
    sim.getPlayer('Ana')!.dead = true;
    sim.handle('Ana', { t: 'shoot', id: w.id });
    expect(w.hp).toBe(ENEMY.wolf.hp);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/shared/sim` → FAIL (`./combat` missing, `roll` ignored).

- [ ] **Step 3: Implement `combat.ts`**

```ts
export const ROLL = { iframes: 0.35, cooldown: 0.8 } as const;
export const BLOCK = { reduce: 0.8, parryWindow: 0.25, rearm: 0.6, parryStun: 1.5, parryDamage: 15 } as const;
export const BOW = { damage: 15, range: 24, cooldown: 0.9, cone: Math.PI / 3 } as const;

export interface Guard { rollUntil: number; rollReadyAt: number; blockSince: number | null; blockReadyAt: number; bowReadyAt: number }
export const newGuard = (): Guard => ({ rollUntil: 0, rollReadyAt: 0, blockSince: null, blockReadyAt: 0, bowReadyAt: 0 });

export type HitOutcome = { kind: 'dodged' } | { kind: 'parried' } | { kind: 'blocked'; dmg: number } | { kind: 'hit'; dmg: number };

export function resolveHit(g: Guard, now: number, dmg: number): HitOutcome {
  if (now < g.rollUntil) return { kind: 'dodged' };
  if (g.blockSince === null) return { kind: 'hit', dmg };
  if (now - g.blockSince <= BLOCK.parryWindow) return { kind: 'parried' };
  return { kind: 'blocked', dmg: dmg * (1 - BLOCK.reduce) };
}

export function inCone(x: number, z: number, yaw: number, tx: number, tz: number, cone: number): boolean {
  const a = Math.atan2(tx - x, tz - z);
  const diff = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
  return diff <= cone;
}
```

- [ ] **Step 4: Implement in `world-sim.ts`**
  - `Live.guard: Guard` (`newGuard()` on connect; reset in `markAway` and `onRespawn`).
  - `handle`: `roll → onRoll`, `block → onBlock(msg.on)`, `shoot → onShoot`.

```ts
  private onRoll(p: SavedPlayer, l: Live): void {
    const g = l.guard;
    if (p.dead || this.time + EPS < g.rollReadyAt) return;
    g.rollUntil = this.time + ROLL.iframes;
    g.rollReadyAt = this.time + ROLL.cooldown;
    g.blockSince = null;
    l.anim = 'roll';
  }

  private onBlock(p: SavedPlayer, l: Live, on: boolean): void {
    const g = l.guard;
    if (!on || p.dead) {
      g.blockSince = null;
      return;
    }
    if (g.blockSince !== null) return;
    // A guard raised too soon after the last one blocks but cannot parry: no free parry by spamming.
    g.blockSince = this.time + EPS >= g.blockReadyAt ? this.time : this.time - BLOCK.parryWindow - 1;
    g.blockReadyAt = this.time + BLOCK.rearm;
  }

  private onShoot(p: SavedPlayer, l: Live, id: number): void {
    const w = this.wolves.find((x) => x.id === id);
    const g = l.guard;
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < g.bowReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > BOW.range || !inCone(p.x, p.z, p.yaw, w.x, w.z, BOW.cone)) return;
    g.bowReadyAt = this.time + BOW.cooldown;
    l.anim = 'bow';
    if (hitWolf(w, BOW.damage)) this.say(`${p.name} derrotó a ${ENEMY_LABELS[w.kind]}`);
  }
```

  - `bite(name, dmg)` becomes `bite(name, dmg, w: Wolf)`:

```ts
    const l = this.live.get(name);
    const out = l ? resolveHit(l.guard, this.time, dmg) : { kind: 'hit' as const, dmg };
    if (out.kind === 'dodged') return;
    if (out.kind === 'parried') {
      w.stun = BLOCK.parryStun;
      if (hitWolf(w, BLOCK.parryDamage)) this.say(`${name} derrotó a ${ENEMY_LABELS[w.kind]}`);
      return this.tell(name, 'Parada');
    }
    p.vitals = damage(p.vitals, out.dmg);
```

- [ ] **Step 5: Run everything** — PASS.
- [ ] **Step 6: Commit** — `feat(aventura): server combat — roll i-frames, block/parry, bow`

---

### Task 3: Client aim, lock-on and roll helpers (pure)

**Files:**
- Create: `src/client/aim.ts`, `src/client/aim.test.ts`
- Modify: `src/client/movement.ts`, `src/client/movement.test.ts`, `src/client/input.ts`, `src/client/input.test.ts`

**Interfaces:**
- Produces:
  - `AimTarget = { id: number; x: number; z: number }`
  - `pickTarget(x, z, yaw, targets, range, cone): number | null` — best = lowest `distance * (1 + angleOff)` inside range and cone
  - `LOCK = { range: 15, keep: 20, cone: Math.PI / 2 }`, `keepLock(id, x, z, targets): boolean`
  - `yawTo(x, z, tx, tz): number` (protocol yaw)
  - `rollInput(facing, camYaw): MoveInput` — the camera-relative input that runs along `facing`
  - `InputState.block: boolean`; `Action` gains `'roll' | 'bow' | 'lock'`; keys `KeyQ` roll, `KeyR` bow, `KeyX` lock, `KeyZ` held block
- Consumes: `inCone` from `src/shared/sim/combat.ts`.

- [ ] **Step 1: Write failing tests**

```ts
// src/client/aim.test.ts
import { describe, expect, it } from 'vitest';
import { keepLock, LOCK, pickTarget, yawTo } from './aim';

const T = [
  { id: 1, x: 0, z: 10 }, // straight ahead (yaw 0 = +z), far
  { id: 2, x: 3, z: 4 }, // ahead-right, close
  { id: 3, x: 0, z: -2 }, // behind, very close
];

describe('pickTarget', () => {
  it('prefers close targets roughly in front and ignores ones behind', () => {
    expect(pickTarget(0, 0, 0, T, 24, Math.PI / 3)).toBe(2);
    expect(pickTarget(0, 0, 0, [T[0]!, T[2]!], 24, Math.PI / 3)).toBe(1);
    expect(pickTarget(0, 0, 0, [T[2]!], 24, Math.PI / 3)).toBeNull();
    expect(pickTarget(0, 0, 0, [T[0]!], 5, Math.PI / 3)).toBeNull();
  });
});

describe('lock', () => {
  it('keeps a lock until the target leaves or dies', () => {
    expect(keepLock(1, 0, 0, T)).toBe(true);
    expect(keepLock(1, 0, 0, [{ id: 1, x: 0, z: LOCK.keep + 1 }])).toBe(false);
    expect(keepLock(9, 0, 0, T)).toBe(false);
  });
  it('yawTo matches protocol yaw', () => {
    expect(yawTo(0, 0, 0, 5)).toBeCloseTo(0);
    expect(yawTo(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2);
  });
});
```

`src/client/movement.test.ts`:

```ts
it('rollInput runs along the facing whatever the camera does', () => {
  const flat = { heightAt: () => 5 } as unknown as Terrain;
  for (const [facing, cam] of [[0, 0], [1, -2], [Math.PI, 0.5]] as const) {
    const b = createBody(0, 0, flat);
    stepBody(b, rollInput(facing, cam), cam, 0.1, flat, () => []);
    expect(Math.atan2(b.x, b.z)).toBeCloseTo(facing);
  }
});
```

(Use the file's existing flat-terrain helper if it has one.)

`src/client/input.test.ts`: `expect(KEY_ACTIONS.KeyQ).toBe('roll'); expect(KEY_ACTIONS.KeyR).toBe('bow'); expect(KEY_ACTIONS.KeyX).toBe('lock');`

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**

```ts
// src/client/aim.ts
import { inCone } from '../shared/sim/combat';

export interface AimTarget { id: number; x: number; z: number }
export const LOCK = { range: 15, keep: 20, cone: Math.PI / 2 } as const;

export function yawTo(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, tz - z);
}

/** Soft auto-aim: the closest target, weighted by how far off-centre it is. */
export function pickTarget(x: number, z: number, yaw: number, targets: readonly AimTarget[], range: number, cone: number): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d > range || !inCone(x, z, yaw, t.x, t.z, cone)) continue;
    const a = yawTo(x, z, t.x, t.z) - yaw;
    const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    const score = d * (1 + off);
    if (score < bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return best;
}

export function keepLock(id: number, x: number, z: number, targets: readonly AimTarget[]): boolean {
  const t = targets.find((o) => o.id === id);
  return !!t && Math.hypot(t.x - x, t.z - z) <= LOCK.keep;
}
```

```ts
// src/client/movement.ts
/** Stick input (camera-relative) that moves along `facing`: used for the roll dash. */
export function rollInput(facing: number, camYaw: number): MoveInput {
  return { x: Math.sin(facing - camYaw), z: Math.cos(facing - camYaw), sprint: true, jump: false };
}
```

`input.ts`: `block: boolean` in `InputState`; `HOLD.KeyZ = 'block'`; `Action` adds `'roll' | 'bow' | 'lock'`; `KEY_ACTIONS` adds `KeyQ: 'roll', KeyR: 'bow', KeyX: 'lock'`. Every `InputState` literal (game.ts) gets `block: false`.

- [ ] **Step 4: Run everything** — PASS.
- [ ] **Step 5: Commit** — `feat(aventura): soft auto-aim, lock-on and roll input helpers`

---

### Task 4: Client wiring — actions, touch, visuals

**Files:**
- Modify: `src/client/game.ts`, `src/client/touch.ts`, `src/client/actors/actor.ts`, `src/client/style.css` (lock marker only if needed)

**Interfaces:**
- Consumes: everything from Tasks 1–3.

No new unit tests (DOM/Three wiring). Verification is `npm run check`, `npm run build` and the in-browser check.

- [ ] **Step 1: Actor clips** — `PLAYER_CLIPS` adds `roll: { clip: 'WalkJump', speed: 1.6, once: true }`, `block: { clip: 'Idle', speed: 0.3 }`, `bow: { clip: 'Punch', speed: 0.7, once: true }` (the robot kit has no roll/guard/bow clips; placeholders).
- [ ] **Step 2: Touch** — `PILL_BUTTONS` adds `{ code: 'KeyQ', label: '🌀', sub: 'rodar', cls: 'pill' }`, `{ code: 'KeyZ', label: '🛡️', sub: 'bloquear', cls: 'pill', hold: 'block' }`, `{ code: 'KeyR', label: '🏹', sub: 'arco', cls: 'pill' }`, `{ code: 'KeyX', label: '🎯', sub: 'fijar', cls: 'pill' }`. `release()` also clears `input.block`.
- [ ] **Step 3: Game state** — fields `lockId: number | null`, `rollUntil`, `rollReadyAt`, `bowUntil`, `blockSent`, a lock marker mesh (small red cone floating over the target) and a short-lived arrow mesh.
- [ ] **Step 4: Actions** in `onAction`:
  - `roll`: if `now >= rollReadyAt`: `rollUntil = now + 350`, `rollReadyAt = now + 800`, send `{ t: 'roll' }`.
  - `lock`: if locked → unlock; else `lockId = pickTarget(b.x, b.z, b.facing … LOCK.range, LOCK.cone)` over live enemies (falls back to camera forward yaw `rig.yaw + π` when nothing is in front of the body); toast `Nada que fijar` when null.
  - `bow`: target = `lockId ?? pickTarget(..., BOW.range, BOW.cone)` using camera-forward yaw; none → toast `Nada a tiro`. Otherwise face it (`b.facing = yawTo(...)`), send a `move` right away (the server checks the cone against the last move's yaw), then `{ t: 'shoot', id }`, `bowUntil = now + 500`, spawn the arrow.
  - Melee in `act()`: prefer the locked enemy if it is within `PUNCH.reach`, and face it.
- [ ] **Step 5: Frame**:
  - Blocking: `input.block` changes → send `{ t: 'block', on }`. While blocking, halve the stick and drop sprint.
  - Rolling: `mv = rollInput(b.facing, rig.yaw)` until `rollUntil`.
  - Anim priority: dead > roll > bow > attack > block > movement.
  - Lock: drop it when `keepLock` fails or the target is dead; while locked, turn `b.facing` toward it (when not moving the stick) and ease `rig.yaw` so the camera sits behind the player looking at the target (`rig.yaw += angleDiff(target camYaw, rig.yaw) * min(1, dt * 4)`, target camYaw = `yawTo(...) + π`).
  - Brutes: scale 1.8 and a dark purple tint is not required; scale only (`kind === 'brute' ? 1.8 : raid ? 1.3 : 1`).
- [ ] **Step 6: Desktop prompt** — when an enemy is locked show `X · Soltar objetivo`.
- [ ] **Step 7: Verify** — `npm test && npm run test:workers && npm run check && npm run build`. Local browser: roll, block, bow and lock keys send messages; pills visible with `?touch=1`.
- [ ] **Step 8: Commit** — `feat(aventura): combat controls — roll, guard, bow, lock-on (keys + touch)`

---

### Task 5: Ship

**Files:** none

- [ ] **Step 1:** `git push origin aventura/slice-1`.
- [ ] **Step 2:** Add a Plan B note to the draft PR (#2) with the playtest checklist: roll through a bite (no damage), tap guard just before a bite ("Parada", fox freezes), hold guard (little damage), 🏹 without aiming hits the fox in front, 🎯 locks and the camera follows, brutes appear from siege level 1. No merge: merge to `main` deploys.

---

## Self-review notes

- **Spec coverage (§5):** attack (existing punch, now lock-aware), dodge roll (Tasks 2–4), bow with soft auto-aim (Tasks 2–4), block with parry on precise timing (Task 2), soft lock-on to the nearest target (Tasks 3–4). "Weapons do not break": nothing breaks. "One active power": deferred to Plan E. "Bosses weakened by parry": parry stuns + damages any enemy through `Wolf.stun`, which a boss can reuse (Plan F).
- **Generic enemy type:** `EnemyKind` + `ENEMY` table; the `Wolf` record and `stepWolf`/`stepRaider` stay (renaming would churn every file for no gameplay). Plan F's boss and Plan G's beasts add kinds to the table.
- **Trust:** the client picks targets; the server re-checks range, cone (bow), reach (melee), cooldowns and alive state. Roll i-frames are server time, so a client cannot extend them.
- **Parry spam:** a guard raised within `BLOCK.rearm` of the previous one blocks without a parry window.
- **Types:** `EnemyKind`, `ENEMY`, `Wolf.stun`, `Guard`, `resolveHit`, `inCone`, `pickTarget`, `rollInput` are used consistently across Tasks 1–4.
