# Pulido · P7-A: Impacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-A of the spec's plan map (§14), the first plan of #7. (1) **The server tells who hit what**: an optional `fx` list in the snapshot (`{ id, dmg, kind: 'hit' | 'kill' | 'parry' | 'block', by?, hp? }`, ≤ 6 per snap, only within 40 m) and `self.hurt?` (damage taken since the last snapshot); `PROTOCOL_VERSION` 62 → 63. (2) **Impact on screen** (§3.2): white flash on the struck enemy (paper: squash 10 %), hit-stop on your own hits (60 ms, 110 ms on parry/kill: your robot's and the enemy's animation and the camera freeze; the simulation, interpolation and network never do), the killed enemy thrown back 0.6 m, camera shake (Normal / Suave / Nada; default Suave on touch, Normal on PC), vibration where `navigator.vibrate` exists, a floating health bar over common enemies for 3 s after each hit, a red screen edge when hurt (and a slow pulse under 25 % health), your robot flashing red. (3) **Camera** (§3.3): no longer clips through walls, rocks, pillars and structures (ray against the loaded `colliders` + terrain samples, eased), 3.5 m inside dungeons, softer lock (τ 0.15 s). (4) **Per-player entry visions** (§10.1): the swamp / mountains / Tierras visions reach every player the first time *they* walk in, not only the first player of the world.

**Architecture:** server: `world-sim.ts` gains a ring of `fx` entries with a sequence number (`strike`, `bite` and the anchor path push; each `Live` remembers the last seq it was sent, so events handled between ticks are never lost) and `Live.hurt` (summed in `hurt()`, read and zeroed by `snapshotFor`); `SavedPlayer.seen?` (optional, old saves load). Client, pure and tested: `src/client/impact.ts` (fx → reaction for me: flash / freeze / shake / vibrate / knock; `Shake` decaying two-sine noise; `HpBars` tracker with 3 s timers; hurt edge strength), `src/client/settings.ts` (`bosque.settings`, JSON, `try/catch`, defaults by device; only `shake` and `vibrate` for now — P7-C adds the rest to the same key), `src/client/camera-clip.ts` (segment vs circles and terrain → safe distance). Client, wiring: `Puppet.impact(flash, freeze, knock)` in `actor.ts` / `paper.ts`, `scene/hp-bars.ts` (pool of 4, two quads each, one shared material pair), `camera-rig.ts` (clip + dungeon distance + shake offset), `hud.ts` (red edge div + two menu selects), `game.ts` wires it.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, `@cloudflare/vitest-plugin`, harness `npm run perf`.

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §2 (pilares), §3.1–3.3, §6 (sacudida, vibración), §10.1 (cámara, visiones por jugador), §13 (riesgos: tráfico `fx`, hit-stop como lag), §14 (P7-A).

## Global Constraints

- **No balance or rule change.** Damage, HP, timings, parry windows, AI: untouched. `fx` and `hurt` only *report* what already happens; the knock-back and hit-stop are purely visual (client).
- **Protocol:** `PROTOCOL_VERSION` 62 → 63 (the tests that pin 62 are updated to 63: intentional). `fx`, `self.hurt` and `SavedPlayer.seen` are optional; old saves load unchanged. No new client message.
- **Budgets (visuales §3):** low ≤ 120 calls / 250 k tris, medium ≤ 180 / 500 k, high ≤ 260 / 1.2 M. The bars cost 0 calls when hidden (≤ 8 when four are up, only after a hit); the flash swaps in one shared material; the red edge is CSS. The harness pass must not change the baseline; if it does, update it on purpose and say why.
- **Touch grid ≤ 10 pills:** unchanged (no new pill). Settings live in the Menú (two selects next to "Calidad gráfica").
- Spanish player-facing text, dry voice. `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] `fx` delivery by sequence, not by tick.** Blows land both inside `step` and in message handlers between ticks; a global list with a monotonically increasing `seq` (pruned to the last 2 s) plus `Live.fxSeq` makes every event reach each nearby player exactly once. ≤ 6 per snapshot (newest kept), only when the struck enemy is ≤ 40 m from the receiver.
- **[D] `hp?` (0–1, two decimals) added to each `fx` entry** — the spec derives the bar from `dmg` over `ENEMY[kind].hp`, but raid scaling and burns move the real HP; one number is exact and cheaper than a client table.
- **[D] What emits `fx`:** `strike` when the blow actually lands on the generic path (`hit` / `kill`) and on anchors; `bite` on a parry (`parry`, `by` = the parrier; its `strike` then adds the `hit`) and on a guarded blow (`block`, `id` = the biter). Deflected blows ("El papel doblado aguanta…") and the special fights (El Marchito, the final Marchito, el Corazón Negro) emit nothing — they already have their own bars and tells.
- **[D] `self.hurt`** sums what `hurt()` applies (bites, blows, unavoidable hits: every source that already goes through it). Continuous zone damage (ciénaga, zarzal, espesura, ceniza) and fall damage do not count: a red edge that never goes away says nothing.
- **[D] Flash** = the actor's meshes swap to one shared white `MeshBasicMaterial` for 80 ms (then the real materials come back); paper = `color` × 2 + squash 10 % for 80 ms. No per-instance material, no emissive on the shared skins (it would light every wolf of that type).
- **[D] Hit-stop** only for `by === me` (60 ms `hit`/`block`, 110 ms `parry`/`kill`): `Puppet.impact` freezes that actor's mixer; the local robot freezes too; the camera keeps its last pose for the same time. Friends' hits: flash only.
- **[D] Knock-back** on `kill` by anyone: the model (not the root: interpolation keeps owning the root) slides 0.6 m away from the killer over 0.2 s.
- **[D] Shake** = `A · e^(−t/0.18) · (sin(47 t), sin(31 t + 1.3))` on camera right/up, summed after `CameraRig.apply`, scale Normal 1 / Suave 0.4 / Nada 0. Amplitudes from §3.2 (hit 0.05 push forward, kill 0.12, parry 0.15, block 0.05, hurt min(0.2, dmg/100)). The deer's bucking shake goes through it too.
- **[D] Vibration** default on; 15 / 30 / 40 / 10 / 25 ms per §3.2; `navigator.vibrate?.()` in `try`.
- **[D] Settings** in `localStorage['bosque.settings']` (JSON, `try/catch`): `{ shake: 'normal' | 'suave' | 'nada', vibrate: boolean }`, default shake `suave` if `isTouchDevice()` else `normal`. Two selects in the current Menú ("Sacudida", "Vibración"); P7-C moves them to the Ajustes tab.
- **[D] Floating bar** only for `wolf`, `brute`, `rayo` (the ones without a HUD bar); 3 s after the last hit, hidden at 0. Pool of 4 (oldest reused), two camera-facing quads (dark back, green→red front), `depthTest: false`.
- **[D] Red edge** = a fixed `div` with an inset `box-shadow`, opacity `min(0.8, 0.25 + hurt/40)` fading over 250 ms; under 25 % health a CSS animation pulses it (1.2 s). The robot's own flash is the white-flash code with a red material.
- **[D] Camera clip:** the segment from the eye to the wanted camera position is tested against the `ColliderGrid` circles near the player (radius + 0.3 m) and 6 terrain samples (+0.4 m); the camera sits at the first hit − 0.3 m (min 0.8 m); it pulls in instantly and eases back out (k 0.1 per frame). Dungeon gates (`clampStep`) are not circles and are not tested: the dungeon distance (3.5 m) mostly covers them.
- **[D] Lock easing** `1 − e^(−dt/0.15)` for the yaw (was `dt·4`); "enemy in the upper third" is not done (the pitch stays the player's: changing it fights the thumb on phones).
- **[D] Per-player visions:** `SavedPlayer.seen?: ('swamp' | 'mountains' | 'corrupt')[]`. The world's first entry still broadcasts (as today) and marks every active player seen; afterwards, a player who walks in without the mark gets the same vision with their own name (`to: name`). A veteran from before 63 has no marks and sees each vision once more — accepted, cheaper than guessing.

## File Structure

- Create `src/client/impact.ts` (+test), `src/client/settings.ts` (+test), `src/client/camera-clip.ts` (+test), `src/client/scene/hp-bars.ts`.
- Modify `src/shared/protocol.ts` (+test), `src/shared/sim/world-sim.ts` (+ new `world-sim-p7a.test.ts`), `src/client/actors/actor.ts`, `src/client/actors/paper.ts`, `src/client/camera-rig.ts`, `src/client/hud.ts`, `src/client/style.css`, `src/client/game.ts`.

## Tasks

### Task 1: server — `fx`, `self.hurt`, per-player visions (protocol 63)

```ts
// protocol.ts
export const PROTOCOL_VERSION = 63;
export type FxKind = 'hit' | 'kill' | 'parry' | 'block';
export interface FxView { id: number; dmg: number; kind: FxKind; by?: string; hp?: number }
// snap: fx?: FxView[]            SelfState: hurt?: number
// world-sim.ts
export const FX = { radius: 40, max: 6, keep: 2 } as const;
```

- [ ] **Step 1: failing tests** (`world-sim-p7a.test.ts`): a punch that lands on a wolf → the puncher's next snapshot has `{ id, kind: 'hit', by, dmg, hp < 1 }`, the one after has none (sent once); a killing blow → `kind: 'kill'`, `hp: 0`; a player 60 m away gets nothing, one 20 m away gets it; ≤ 6 entries; a bite on an unguarded player → `self.hurt > 0` in the next snap, then absent; a guarded bite → `block` + reduced `hurt`; a timely guard → `parry` (and no `hurt`); the swamp vision reaches A when A enters first (broadcast), and later reaches B alone (`to: 'B'`) when B enters; B entering again gets nothing; a save without `seen` loads; `PROTOCOL_VERSION === 63`.
- [ ] **Step 2: implement.** `fx` ring + `Live.fxSeq`; `Live.hurt`; `SavedPlayer.seen`; `stepRaid` visions per player. Existing tests pinning 62 → 63.
- [ ] **Step 3:** green, commit `feat(pulido): golpes y daño en el snapshot, visiones por jugador (protocolo 63)`.

### Task 2: pure client — reactions, shake, bars, settings, camera clip

```ts
// impact.ts
export interface Reaction { flash: boolean; freeze: number; shake: number; vibrate: number; knock: boolean; bar: boolean }
export function reactTo(fx: FxView, me: string, kind: EnemyKind | undefined): Reaction;
export function hurtReaction(hurt: number): { edge: number; shake: number; vibrate: number };
export class Shake { add(a: number): void; step(dt: number): { x: number; y: number } }   // scaled outside
export class HpBars { hit(id: number, hp: number, now: number): void; visible(now: number): { id: number; hp: number }[] } // ≤ 4, 3 s
export const SHAKE_SCALE: Record<ShakeSetting, number>;
// settings.ts
export type ShakeSetting = 'normal' | 'suave' | 'nada';
export interface Settings { shake: ShakeSetting; vibrate: boolean }
export function defaultSettings(touch: boolean): Settings;
export function parseSettings(raw: string | null, touch: boolean): Settings;   // bad JSON / bad values → defaults
export function loadSettings(touch: boolean): Settings; export function saveSettings(s: Settings): void;
// camera-clip.ts
export function clipDistance(eye: V3, dir: V3, want: number, circles: Circle[], heightAt: (x: number, z: number) => number): number;
```

- [ ] **Step 1: failing tests.** `reactTo`: my hit → flash, freeze 0.06, shake 0.05, vibrate 15, bar (wolf); my kill → freeze 0.11, knock, shake 0.12; parry by me → freeze 0.11, shake 0.15, vibrate 40; friend's hit → flash only; boss kind → no bar. `hurtReaction`: 0 → nothing; grows with damage, shake capped 0.2. `Shake`: decays under 5 % in 0.6 s, zero stays zero. `HpBars`: 3 s life, fifth hit reuses the oldest, hp 0 hides. `parseSettings`: garbage → defaults; touch → suave; PC → normal. `clipDistance`: open field → want; a circle halfway → hit − 0.3; never below 0.8; a hill between → shortened.
- [ ] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): reacciones de impacto, sacudida, barras y choque de cámara (puro)`.

### Task 3: impact on screen

- [ ] **Step 1:** `Puppet.impact(o: { flash?: number; freeze?: number; knock?: { x: number; z: number }; red?: boolean })` in `Actor` (shared white/red materials swapped on meshes, mixer dt 0 while frozen, model offset for the knock) and `PaperActor` (color ×2, squash, freeze = no bob time, knock on the pivot). `scene/hp-bars.ts` (pool of 4, 8 meshes, 2 shared materials). `hud.ts`: `#hurt-edge` + `setHurt(edge, low)`; two menu selects (Sacudida / Vibración) → `saveSettings`. `game.ts`: on each snap, `fx` → `reactTo` → puppets / bars / shake / vibrate / freeze; `self.hurt` → edge + red flash of my robot + shake; health < 25 % pulse; shake offset after `rig.apply` (bucking deer uses it too); camera frozen while my freeze lasts.
- [ ] **Step 2:** green, commit `feat(pulido): parpadeo, hit-stop, sacudida, vibración, barra flotante y borde rojo`.

### Task 4: camera — walls, dungeons, lock

- [ ] **Step 1:** `CameraRig.apply(cam, target, terrain, circles?, indoors?)`: dist 3.5 when indoors (`inAnyDungeon`), `clipDistance` with `colliders.near`, instant in / eased out; lock easing τ 0.15 s in `game.ts`.
- [ ] **Step 2:** harness `npm run perf` (3 tiers). Green, commit `feat(pulido): la cámara no atraviesa muros ni rocas, más cerca en mazmorras`.

### Task 5: Ship

- [ ] HANDOFF "## Pulido · P7-A — …" (Decidido por Claude — revisar, Qué probar, NO verificado, perf); push; one short comment on PR #3.
