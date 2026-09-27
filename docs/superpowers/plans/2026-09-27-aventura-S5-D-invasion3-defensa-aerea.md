# Aventura — Slice 5 · S5-D: Invasión 3 en el Corazón y la defensa aérea del dragón — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El Marchito's last invasion, the first one aimed at the Heart itself (spec S5 §8). Breaking the **4th Pilar-raíz** sets `SavedWorld.invasion3 = 'pending'` with the vision «Ah. Ahora voy yo.» (resolves the `// S5-D` marker in `breakPillar`). At the **next dusk warning** with a living Heart and someone outside the dungeons, he walks in from the **north** (the tower's side, 28 m out) — "El Marchito viene a por el Corazón" — and that night's raid comes from the north **×1.5** plus **6 rayos marchitos**. He walks to the Heart and **channels 90 s** (bar "El Marchito envuelve el Corazón · 40 % · voluntad …"), swiping 14 at anyone within 3 m. **Voluntad** = Invasion 1's formula by active players **×1.3** (390 / 546 / 702 / 858). Driven off → he leaves, the Heart is untouched, «Mañana, en mi casa. Traigan a sus bichos blancos.». Not driven off → the Heart **drops to 1 PV (never withers)**, he laughs and leaves, meaner vision. **Either way** the raid runs to dawn; at dawn `invasion3 = 'done'`, `towerOpen = true`, "Amanece. La puerta de la Torre se abre". **Air defense:** riding the dragon, the attack (pill / click) is a **zarpazo** that hits a rayo within 5 m in 3D for **40**, 1 s cooldown (also over the Espinar); nothing else can be hit from the air. Each **tamed dragon parked within 30 m of the Heart at night** bites the nearest rayo within 12 m every 3 s for 40. Rayos in raids dive at players **and structures** (10 per dive to a wall/trap), never the Heart.

**Architecture:** `sim/marchito.ts`: `MARCHITO.channelFor = 90`, `heartWill(players)`, `Marchito.channel: number | null`, pure `stepChanneler(m, heart, players, heightAt, dt)` → `'swipe' | 'drained' | 'leave'`, new `VISION` lines (`armed3`, `arrive3`, `driven3`, `drained3`). `dragon.ts`: `AIR` constants, pure `zarpazoReach(rider, rayo)` and `guardTarget(dragon, heart, rayos)`. `sim/rayo.ts`: nothing new — a raid rayo is stepped with players **plus structure pseudo-targets** (`#<id>`), and a hit on `#<id>` damages that structure. Server (`world-sim.ts`): `SavedWorld.invasion3?`, `towerOpen?`; `stepInvasion3`; `spawnRaiders` scales and adds rayos when the raid carries `big`; `onAttack` branches for dragon riders; `stepSkyGuard` for parked dragons. Snapshot: `MarchitoView.channel?`, `snap.towerOpen`. Client: bar text, zarpazo targeting from the dragon, "Zarpazo" hint, a violet door at the tower foot when open.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §8, §16, §17 row S5-D. Pattern: Plan H (Invasion 1) and S2-H (Invasion 2).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`villain`, `heart`, `villainTower`).
- **Touch grid stays at 10 pills.** Zarpazo = the existing attack pill / A while riding the dragon (contextual). No new message: it is `{ t: 'attack', id }`, re-checked on the server (rider, rayo, 3D distance, cooldown).
- **Protocol:** Task 2 bumps 48 → 49 (`MarchitoView.channel?`, `snap.towerOpen`, raid rayos). Task 3 bumps 49 → 50 (attack from the dragon accepted with a 3D reach). New saved fields optional: `SavedWorld.invasion3?: 'pending' | 'done'`, `SavedWorld.towerOpen?: boolean`. Old saves load with neither (no invasion owed: a save with all 4 pillars broken but no `invasion3` gets `'pending'`, like S2-H's fish rule).
- **Scaling:** voluntad fixed at arrival from `activeCount()` like Invasion 1: `heartWill(n) = round(1.3 × marchitoWill(n))`.
- **[D] Channel reach:** he channels once within `MARCHITO.smashReach` of the Heart's centre; the 90 s run only while someone is active (the world sleeps otherwise, as in Plan H). The bar shows `channel / 90`.
- **[D] 1 PV:** at 100 % the Heart's hp becomes `min(hp, 1)` (a Heart already at 0 stays withered — beasts did that, not him); a `hit` message goes out. He then laughs 4 s and leaves.
- **[D] Invasion order:** only one Marchito at a time. If Invasion 2 is also owed the same dusk, Invasion 2 goes first (it steps earlier); Invasion 3 waits for the next dusk.
- **[D] Save mid-invasion** (from its dusk until dawn) keeps `'pending'`: it comes back the next dusk; what broke stays broken.
- **[D] Raid shape:** the raid's `dir` is set toward the tower (north) and gets `big: true`; `spawnRaiders` uses `ceil(n × 1.5)` (cap `RAID.maxWave × 1.5`) and adds 6 raid rayos 10 m in front of the pack. Lieutenants still lead on their nights.
- **[D] Raid rayos vs structures:** a raid rayo's targets are the living players plus every non-Heart structure as `{ name: '#<id>' }`; a dive that lands on one deals 10 to it. Rayos out of raids are unchanged.
- **[D] Parked dragon guard:** any saved player's `dragon` (parked, not being ridden), owner online or not, within 30 m of the Heart, at night. Rayos only (horizontal 12 m); never ground beasts nor El Marchito. Timer per owner, live-only.
- **Out of this plan:** the tower dungeon (S5-E reads `towerOpen`), the final boss, the ending.
- **Mobile performance:** 0 new draw calls during the day; at night 6 more rayo cards in Invasion 3 (cap 12). The tower door: 1 small plane inside the Tierras group (hidden from the south).
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — the channeler, voluntad ×1.3, air defense

**Files:** Modify `src/shared/sim/marchito.ts`, `src/shared/dragon.ts`; Tests `src/shared/sim/marchito.test.ts`, `src/shared/dragon.test.ts`.

**Interfaces:**
```ts
// marchito.ts
export const MARCHITO = { …, channelFor: 90 } as const;
export interface Marchito { …; channel: number | null }   // Invasion 3: seconds spent on the Heart
export function heartWill(players: number): number;      // round(1.3 × marchitoWill)
export function stepChanneler(m: Marchito, heart: { x: number; z: number }, players: readonly WolfTarget[], heightAt: (x: number, z: number) => number, dt: number): { t: 'swipe'; name: string } | { t: 'drained' } | { t: 'leave' } | null;
VISION.armed3, VISION.arrive3, VISION.driven3(names), VISION.drained3(names)
// dragon.ts
export const AIR = { claw: 40, reach: 5, cooldown: 1, guardR: 30, biteR: 12, every: 3 } as const;
export function clawReach(rider: { x: number; y: number; z: number }, foe: { x: number; y: number; z: number }): boolean;
export function guardTarget<T extends { x: number; z: number; hp: number; kind: string }>(dragon: { x: number; z: number }, foes: readonly T[]): T | null;
```
- [ ] **Step 1: failing tests.** `heartWill(1..4)` = 390/546/702/858. `stepChanneler`: walks toward the Heart, channel stays null/0 far away, then counts; `drained` exactly once at 90 s, then laughs `laughFor` and `leave`; swipes a player within reach (cooldown respected) and does not channel that tick. `clawReach` true at 4.9 m 3D, false at 3 m horizontal + 4.5 m up. `guardTarget` picks the nearest living rayo within 12 m, ignores wolves/brutes/marchito/dead.
- [ ] **Step 2: implement** (`createMarchito` sets `channel: null`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas de la Invasión 3 y de la defensa aérea`.

### Task 2: Server — Invasión 3 (protocol v49)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Create `src/shared/sim/world-sim-s5d.test.ts`; Tests `world-sim.test.ts` / `protocol.test.ts` (version only).

- [ ] **Step 1: failing tests** (`world-sim-s5d.test.ts`):
  - Breaking the 4th pillar sets `invasion3 = 'pending'` (saved) with the vision «Ah. Ahora voy yo.»; the 3rd does not. An old save with 4 pillars and no field loads as `'pending'`; a fresh world saves none.
  - Nothing before dusk; at the warning: Marchito ~28 m **north** (z < heart.z − 20), `max = heartWill(active)`, the raid's dir points north, vision "viene a por el Corazón".
  - Left alone: `snap.marchito.channel` rises; after ~90 s at the Heart its hp is 1 (not 0), he leaves, `invasion3` still pending until dawn; at dawn `'done'` and `towerOpen` (saved) with toast "La puerta de la Torre se abre".
  - Driven off (will to 0 by attack): Heart hp unchanged, vision driven3, dawn still opens the tower.
  - At nightfall the raid has ≥ 6 raid rayos and ≥ 1.5× the normal beasts (compare with the same world without `invasion3`).
  - A raid rayo diving on a wall (no player near) damages the wall by 10; never the Heart.
  - Save mid-invasion → `'pending'`.
- [ ] **Step 2: implement** `stepInvasion3` (start, channel, 1 PV, dawn), `big` raid, raid rayos, snapshot fields, bump v49.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): Invasión 3, El Marchito va a por el Corazón (protocolo v49)`.

### Task 3: Server — zarpazo and parked dragons (protocol v50)

**Files:** Modify `src/shared/sim/world-sim.ts`, `src/shared/protocol.ts`; Tests `world-sim-s5d.test.ts`.

- [ ] **Step 1: failing tests:**
  - Riding the dragon, `attack` on a rayo 4 m away in 3D (flying at its height) → −40; again at once → nothing (1 s); after 1 s → dead. A rayo 3 m away horizontally but 6 m below → nothing. A wolf in reach → nothing, hint "Desde el aire solo alcanzas a los rayos".
  - On foot the old rules still hold (a high rayo: "Vuela alto…").
  - A parked tamed dragon 10 m from the Heart at night bites a rayo within 12 m (−40 within 3 s), not a wolf; a dragon parked 40 m away does nothing; by day nothing; while its owner rides it nothing.
- [ ] **Step 2: implement** the dragon branch of `onAttack` (`AIR`, `clawReach`), `stepSkyGuard(dt, night)`; bump v50.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): zarpazo desde el dragón y dragones que guardan el cielo (protocolo v50)`.

### Task 4: Client + ship

**Files:** Modify `src/client/dungeon-ui.ts` (+test), `src/client/game.ts`, `src/client/scene/villain-tower.ts`, `docs/superpowers/HANDOFF-aventura.md`.

- [ ] **Step 1: failing tests:** `marchitoBarText({ will: 390, max: 390, laughing: false, channel: 0.4 })` → "El Marchito envuelve el Corazón · 40 % · voluntad 390/390". A pure `clawPick(rider, foes)` in `dungeon-ui.ts` (nearest rayo within `AIR.reach` in 3D, else null).
- [ ] **Step 2: implement:** bar text; in `game.ts`'s attack path, when riding the dragon send `attack` for `clawPick` (else toast "Desde el aire solo alcanzas a los rayos"); the attack pill's label reads "Zarpazo" while flying if labels are contextual; a violet door plane at the tower foot while `snap.towerOpen`.
- [ ] **Step 3:** all green; commit `feat(aventura): cliente de la Invasión 3 y el zarpazo`.
- [ ] **Step 4: Ship.** `git push origin aventura/resto` (retry 2/4/8/16 s); append "## Slice 5 · S5-D — …" to the HANDOFF (Spanish, same style), commit, push; one short comment on PR #3.
