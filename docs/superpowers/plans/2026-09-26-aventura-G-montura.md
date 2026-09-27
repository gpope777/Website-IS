# Aventura G — Montura terrestre con anillo de doma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One wild giant deer (el Ciervo) grazes in the forest. Walk up to it and press A: it bucks, and a timing ring spins. Tap when the needle crosses the marked zone, three rounds, each faster with a smaller zone. Miss and it throws you off; try again. Win and the deer is yours: ride it at 12 m/s, park it anywhere (A to get off, A beside it to get on). A friend standing near the deer while you tame it calms it and widens the zone.

**Architecture:** Rules in `src/shared/mount.ts` (constants, ring maths, wild deer spot from the seed). The server (`WorldSim`) owns taming: it picks each round's zone, stamps its start time and judges each tap from a client-sent sim time `at` inside a small window (server-verifiable bounds). It knows who rides, so the move check uses a higher speed cap only for riders (and a 2 s grace after getting off), forbids water and the dungeon while riding, and parks the deer on death, teleport or dismount. The client adds riding to `stepBody` (faster, no climbing, gliding or swimming), a ring overlay drawn from `SelfState.tame` and a primitive deer mesh.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-26-bosque-aventura-design.md` §9 (Mounts), §12 (slice 1: "1 land mount with the timing-ring minigame"). Plan map: see Plan A.

## Global Constraints

- Player-facing text in **Spanish**, dry voice.
- **Phones first.** No new pill (the grid stays at 10): tame / get on / get off use the contextual **A** button (key E; also **M** on keyboard for get on/off). During taming, **A**, **E**, **Espacio** and **tapping the ring itself** all count as a tap.
- **Trust boundary:** the new `{ t: 'mount', act, at? }` goes through `decodeClient`. The server judges every tap; the client never says "hit".
- **Tap timing:** the client sends `at` = its estimate of sim time. The server accepts `at ∈ [now − 0.6, now + 0.15]` and `at ≥ round start`, then judges the ring angle at `at`. A cheater can only pick a moment inside that 0.75 s window of a ring the server laid out; he cannot skip rounds or claim a deer. Recorded as ponytail.
- **Riding speed:** `MOUNT.run = 12`, walk 6. Server cap `MOUNT.maxSpeed = 13` only while the server knows you ride (and `MOUNT.grace = 2` s after getting off); everyone else keeps `MAX_SPEED = 9`.
- **Protocol:** `PROTOCOL_VERSION` 7 → 8. `SavedPlayer.steed?: { x, z }` is optional (present = tamed, where it is parked); old saves load.
- Run `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Shared mount rules + protocol v8

**Files:**
- Create: `src/shared/mount.ts`, `src/shared/mount.test.ts`
- Modify: `src/shared/protocol.ts`, `src/shared/protocol.test.ts`

**Interfaces (produces):**
```ts
export const MOUNT = {
  reach: 3.5, walk: 6, run: 12, maxSpeed: 13, grace: 2, height: 1.1,
  rounds: [ { speed: 2.4, width: 1.3 }, { speed: 3.4, width: 0.95 }, { speed: 4.6, width: 0.65 } ],
  calmWidth: 1.5, calmReach: 6, early: 0.6, late: 0.15, roundTimeout: 8, retry: 2, leash: 6,
  minDist: 50, maxDist: 110,
} as const;
export function ringAngle(speed: number, t: number): number   // [0, 2π)
export function inZone(angle: number, zone: number, width: number): boolean
export function generateWild(terrain, seed, avoid: {x,z}[]): { x: number; y: number; z: number }
```
Protocol: `ClientMsg | { t: 'mount'; act: 0|1|2|3; at?: number }` (0 = start taming, 1 = tap (needs `at`), 2 = get on, 3 = get off); `SteedView { owner: string | null; x; y; z; yaw }`; `TameView { round; rounds; start; speed; zone; width }`; `PlayerView.ride: boolean`; `SelfState.tame: TameView | null; riding: boolean; steed: boolean`; snap `steeds: SteedView[]`.

- [ ] **Step 1: failing tests** (`mount.test.ts`)
```ts
it('ring angle wraps and zones wrap round 0', () => {
  expect(ringAngle(2, Math.PI)).toBeCloseTo(0);
  expect(inZone(0.1, 2 * Math.PI - 0.1, 0.5)).toBe(true);
  expect(inZone(Math.PI, 0, 1)).toBe(false);
});
it('rounds get faster and narrower', () => { /* speeds increase, widths decrease */ });
it('wild deer spawns on dry land in range, away from things', () => { /* 4 seeds */ });
```
Protocol tests: decode `mount` act 0–3, rejects act 4, act 1 without finite `at`; `PROTOCOL_VERSION` is 8.
- [ ] **Step 2:** implement (`ringAngle = ((speed*t) % 2π + 2π) % 2π`; `inZone` = wrapped angular distance ≤ width/2; `generateWild` like `generateEntrance` with its own rng salt).
- [ ] **Step 3:** green, commit `feat(aventura): mount rules and protocol v8`.

### Task 2: Server taming

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `src/shared/sim/world-sim.test.ts`.

- `WorldSim.wild` (from `generateWild`, avoiding entrance/shrines/crags). `Live.tame: { round, start, zone } | null`, `Live.tameReadyAt`.
- `onMount(p, l, act, at)`:
  - act 0: alive, not riding, no steed (`'Ya tienes montura'`), within `MOUNT.reach` of the wild deer, `time ≥ tameReadyAt` → `l.tame = { round: 0, start: time, zone: rng()*2π }`, tell `'El ciervo se encabrita. Pulsa cuando la aguja pase por la zona'`.
  - act 1: needs `l.tame`, `at` in window and `≥ start`; `hit = inZone(ringAngle(speed, at - start), zone, width(calm))`. Miss → `failTame` (`'Te tira al suelo. Otra vez'`, `tameReadyAt = time + retry`). Hit on last round → `p.steed = {x: wild.x, z: wild.z}`, riding, `'El ciervo es tuyo. A para bajar'`. Otherwise next round, new zone, `'Aguanta'`.
- `step`: a taming player who died, moved beyond `leash` or waited past `roundTimeout` fails.
- Calm: another alive, present player within `calmReach` of the deer → width × `calmWidth`.
- `selfState.tame` exposes the round (with width after calm).
- [ ] Tests: start out of reach is ignored; full success with perfect `at`; a miss fails and sets a retry wait; `at` outside window fails; round timeout fails; calm widens width; an existing steed refuses.
- [ ] Commit `feat(aventura): server-judged taming ring`.

### Task 3: Server riding + movement cap

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim.test.ts`.

- `Live.riding`, `Live.rodeUntil`. act 2: has steed, not riding, not in dungeon, within reach of the parked steed → riding. act 3: riding → park steed at `p`, `rodeUntil = time + grace`.
- `onMove`: `cap = riding || time < rodeUntil ? MOUNT.maxSpeed : MAX_SPEED`. Riding and the target is water (`heightAt < WATER_LEVEL − 0.6`) → reject. While riding the crag ceiling does not apply (`y < ground + 4` or going down). Riding updates `p.steed` to the player's position (so a save mid-ride parks it there).
- `teleport` and `kill` dismount (park where you stood). `connect` of a fresh live starts on foot.
- Snapshot: `PlayerView.ride`; `steeds` = the wild deer (`owner: null`) plus every parked steed within view whose owner is not riding.
- [ ] Tests: a rider moves 12 m/s, a walker at 12 m/s is fixed; grace after dismount; water refused while riding; get on out of reach ignored; dungeon enter parks the steed at the door; death parks it; snapshot lists wild + parked, not ridden; save keeps `steed`; old save without `steed` loads.
- [ ] Commit `feat(aventura): ride the tamed deer; server speed cap knows riders`.

### Task 4: Client rules

**Files:** Modify `src/client/movement.ts`, `src/client/input.ts`; Create `src/client/mount-ui.ts`, `src/client/mount-ui.test.ts`; Tests `movement.test.ts`, `input.test.ts`.

- `Body.riding: boolean`. In `stepBody`: riding → speed `MOUNT.walk/run`, no crag grab (crags block), no glider toggle, and a step into swim depth is refused (stay put). `animFor` unchanged (the rider is drawn seated).
- `KeyM → 'mount'` action.
- `mount-ui.ts`: `mountAction(state)` returns `{ act, label } | null` for the A button: taming → tap; riding → `'Bajar del ciervo'`; own parked steed in reach → `'Montar'`; wild deer in reach and no steed → `'Domar al ciervo'`. `ringNeedle(tame, serverTime)` = angle for drawing.
- [ ] Tests for each; commit `feat(aventura): client rules for riding and taming`.

### Task 5: Client visuals + ship

**Files:** Create `src/client/scene/steed.ts`; Modify `src/client/game.ts`, `src/client/hud.ts`, `src/client/style.css`.

- Primitive deer (body, neck, head, legs, antlers), one per `SteedView`, plus one under each riding player (ours and others'). Rider drawn `MOUNT.height` higher.
- HUD ring: SVG circle, zone arc, needle; hidden when `tame` is null; `pointerdown` on it = tap. Camera shakes a little while taming (bucking). Input frozen while taming.
- A button / E: `mountAction` goes after revive/shrine/dungeon; attacks still win while riding when an enemy is in reach. M toggles on/off.
- Prompts: `'E · Domar al ciervo'`, `'E · Montar'`, `'E / M · Bajar'`, `'¡Ahora! (E)'`.
- [ ] Build, check; commit `feat(aventura): the deer, the ring and riding on the client`.
- [ ] **Ship:** `git push origin aventura/slice-1`; append Plan G to `docs/superpowers/HANDOFF-aventura.md`; short note on PR #2.

## Self-review notes

- Spec §9 coverage: timing ring, 3 rounds faster + smaller, failure throws you off with retry, co-op calm widens the zone, land = ring + bucking (camera shake). Out: hauling materials (would need carrying capacity, deferred), legendary beasts, drawn mounts (the deer is primitives; swap for a drawing later).
- Only one wild deer, and it never leaves: every player tames their own copy from the same deer (simplest; no "stolen" beast in co-op).
- The deer does not follow you: it stays where you got off. A whistle is a later idea.
- Riders can still fight (A attacks when an enemy is in reach), harvest needs getting off.
