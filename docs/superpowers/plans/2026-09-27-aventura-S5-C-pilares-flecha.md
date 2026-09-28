# Aventura — Slice 5 · S5-C: los 4 Pilares-raíz, el agua del Lago Negro, zonas 18–21 y La Flecha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The tower's four shields, one per power, each reached with a different mount (spec S5 §4–§6, §9). **Pilar de Enredadera** in a thorn thicket (10 PV/s): Enredadera on its 3 bare roots makes 3 root bridges to the core (walk in). **Pilar de Viento** under **el Lago Negro, which now has water**: dive with the fish to the anchor on the bottom (150 PV, only reachable diving), break it, the core surfaces on the east shore; 3 Viento gusts blow its miasma off. **Pilar de Fuego** in the middle of **la Carrera de ceniza** (hot ash, 4 PV/s on foot, 0 mounted: the deer): 3 Llamaradas burn its thorn cocoon; 3 rayos guard it. **Pilar de Piedra** on top of **los Escalones rotos** (frog or dragon): a lid covers the core until a Piedra pillar (or a friend) weighs its plate. Every core breaks with **A held 3 s** at ≤ 2.5 m: "El Pilar-raíz de <poder> se parte (n/4)", a vision per pillar, a tower crack goes dark, and pillars 0–2 cleanse zones 19–21. **Zones 18–21** (18 = la Torre, r 30, cleansed only by S5-F/G). **`corruptSeen`**: first living player in las Tierras → vision «Mi casa. Limpien los pies, <nombre>.». **La Flecha** (`enemy10.png`, 3 m): while `corruptSeen` and zone 18 is corrupt, leads raids with **`raidN % 3 === 2`** (Gata 0, Triángulo 1: never the same night). 360 PV, wolf walk, kicks 12 / 2 s, **clavada** every 7 s (1.0 s red line, dash 20 m/s, 20 damage; sticks 4 s in a structure it crosses). Beating it: raid flees, 2 espinas negras to each player within 40 m, vision «Mi flecha… Suban, <nombres>. Arriba se acaba.». The 4th pillar leaves a `// S5-D` marker (Invasión 3 is armed in S5-D).

**Architecture:** `terrain.ts`: `BLACK_LAKE`, `Terrain.waterAt?` (filled by `createTerrain`: the lake's surface inside its circle, `WATER_LEVEL` elsewhere) and `waterLevel(t, x, z)`; `withEscalera` forwards it. New `src/shared/pillars.ts` (pure): `PILLAR`, `THICKET`, `ASH_RUN`, `LAKE_PILLAR`, `LID`, `pillarSites(t, seed)`, `thicketHurts`, `ashHurts`, `lidUp`, `pillarBlock` (what is still missing, as text). `corruption.ts`: `CORRUPT_ZONES` (18–21), `generateCorruptZones`, `isCorruptLandZone`; `isMountainZone` narrows to 14–17; `allZones` appends. Swim/fish rules (`fishStepOk`, server moves, client `stepWalk`/`stepFish`) read `waterLevel` instead of `WATER_LEVEL`. Server: `SavedWorld.pillars?`, `corruptSeen?`; live pillar state; `{ t: 'pillar', id }` starts the 3 s pull; `snap.pillars`. `sim/lieutenant.ts`: `FLECHA`, `flechaLeads`, pure `stepFlecha`, `clavadaStop`. Client: lake water disc, pillar setpieces in `scene/pillars.ts`, tower cracks, La Flecha as a PaperActor with its red line.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §3.3 (cracks), §4, §5, §6, §9, §16, §17 row S5-C.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`rootPillar`, `lieutenant3`, `blackLake`, `brokenSteps`, `villainTower`, `thorn` exist since S5-A). The names test forbids "Flecha" by hand.
- **Touch grid stays at 10 pills.** No new pill: the core is the contextual A ("Arrancar el núcleo"); roots, gusts, flames and Piedra use the power pill; the anchor the attack (A) diving.
- **Trust boundary:** new client message `{ t: 'pillar'; id }` (id 0–3) through `decodeClient`; the server checks alive, reach, not broken, the pillar's own condition, and cancels the pull if you leave. Anchor hits are re-checked in height on the server.
- **Protocol:** Task 2 bumps 46 → 47 (`pillar` message, `snap.pillars`, zones list grows, lake water changes accepted moves). Task 3 bumps 47 → 48 (`EnemyKind` + `'lieut3'`, `WolfView.aim?` / `stuck?`). New saved fields optional: `SavedWorld.pillars?: number[]`, `SavedWorld.corruptSeen?: boolean`. Old saves load with no pillar broken and 18–21 corrupt.
- **[D] Positions** (d = metres north of the rim, from `pillarSites`): Enredadera core at (−15, d 115), thicket r 15, 3 roots on its edge at 120° steps; Viento: anchor at the lake's centre on the bed, core on the east shore (lake.x + r + 4); Fuego core at (45, d 105) with the hot ash a **disc of r 35** around it (the spec's "120 m strip" read as a disc: a strip can be walked around; a disc cannot — ride in and out ≈ 70 m); Piedra core on the top terrace of los Escalones (x, d0 + 34), plate 3 m west.
- **[D] Lake water:** the Lago Negro is **always wet** from now on (not tied to breaking its pillar: the pillar needs the water). Surface = the basin's rim level − 4 m (≈ 10 m deep in the middle). `waterAt` is the only new terrain call; things that only ask "is this below `WATER_LEVEL`?" (wolf pathing, spawns) keep ignoring the lake — up here nothing paths.
- **[D] "A held 3 s"** = A starts a 3 s pull on the server (toast "Tiras del núcleo…"); walking > 2.5 m away, dying or entering a dungeon cancels it. The pillar's condition is checked at the start only.
- **[D] Anchor:** a world object with enemy kind `'anchor'` (drawn like the S2-H anchors) and id **930_001** (the new 930_000+ range, spec §16.1); it only takes hits (sword or gust ×3) from ≤ 4 m above its bed: "Está en el fondo. Bucea con el pez". Live-only PV (a restart puts it back to 150, like the knot).
- **[D] Lid:** up while a Piedra pillar is within 1.5 m of the plate or **another** living player stands on it (≤ 1.2 m).
- **[D] Rayo guards:** the first time (per load) a living player comes within 35 m of the Fuego core while it stands, 3 rayos spawn over it (normal wolf ids; they count toward the cap of 8).
- **[D] Thorns and ash** hurt only while their pillar stands; ash hurts walkers and swimmers, never riders (deer, frog, fish, dragon) nor a seated passenger. Thicket: not on a root bridge (1.2 m of the root→core line) nor in the 3 m clearing around the core.
- **[D] La Flecha** uses a normal wolf id, like the Gata and the Triángulo (the spec's 900_008 is not needed: only one-per-world bosses carry fixed ids). Clavada: aims at the target's spot + 4 m beyond it (≤ 24 m), line shown 1.0 s (`WolfView.aim`), dash 20 m/s; each living player within 1.2 m of its path takes 20 once (roll dodges through `bite`); a player structure (not the Heart) within 1.5 m of the line stops it there, stuck 4 s (`stuck`).
- **Out of this plan:** Invasión 3 (S5-D marker on the 4th pillar), the tower door (S5-E), zone 18's cleansing (S5-F/G), la Grieta (S5-G).
- **Mobile performance:** 4 pillar spikes + cores, 1 instanced thicket (~36 cones), 3 roots/bridges, 1 cocoon, 1 lid + plate, 1 lake disc, 1 chain: ~14 draw calls, **all hidden unless the Tierras group is visible** (S5-A hides it south of z = −HALF − 110). Tower cracks: 1 merged mesh (+1 call). La Flecha: 1 PaperActor + 1 red line only during her raid.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Rules — lake water, pillar sites, zones 18–21

**Files:** Modify `src/shared/terrain.ts`, `src/shared/mountains.ts` (`withEscalera`), `src/shared/corruption.ts`, `src/shared/fish.ts`; Create `src/shared/pillars.ts`, `src/shared/pillars.test.ts`; Tests `corruption.test.ts`, `corrupt-lands.test.ts`.

**Interfaces:**
```ts
// terrain.ts
export const BLACK_LAKE = { dry: 4 } as const;        // surface = basin rim level − 4
export interface Terrain { heightAt; density; waterAt?(x: number, z: number): number }
export function waterLevel(t: Terrain, x: number, z: number): number; // t.waterAt?.(x, z) ?? WATER_LEVEL
// pillars.ts
export const PILLAR = { count: 4, idBase: 930_000, hold: 3, reach: 2.5, powers: ['enredadera', 'viento', 'fuego', 'piedra'] } as const;
export const THICKET = { r: 15, clear: 3, rootReach: 3, bridge: 1.2, dps: 10, x: -15, d: 115 } as const;
export const LAKE_PILLAR = { anchorHp: 150, gustMult: 3, dive: 4, miasma: 3, shore: 4 } as const;
export const ASH_RUN = { r: 35, dps: 4, guards: 3, burns: 3, x: 45, d: 105 } as const;
export const LID = { plateOff: 3, plateR: 1.2, pillarR: 1.5, top: 34 } as const;
export interface PillarSites { cores: { x: number; z: number }[]; roots: { x: number; z: number }[]; anchor: { x: number; z: number }; plate: { x: number; z: number } }
export function pillarSites(seed: number): PillarSites;
export function thicketHurts(s: PillarSites, bridged: readonly boolean[], x: number, z: number): boolean;
export function ashHurts(s: PillarSites, x: number, z: number): boolean;
export function lidUp(s: PillarSites, pillars: readonly { x: number; z: number }[], others: readonly { x: number; z: number }[]): boolean;
// corruption.ts
export const CORRUPT_ZONES = { firstId: 18, tower: 18, towerR: 30, r: 18 } as const;
export function isCorruptLandZone(id: number): boolean;   // ≥ 18
export function isMountainZone(id: number): boolean;      // 14..17 (was ≥ 14)
export function generateCorruptZones(seed: number): Zone[]; // 18 tower, 19 vine core, 20 lake centre, 21 fire core
```
- [x] **Step 1: failing tests.** For 4 seeds: `waterLevel` at the lake's centre is 8–12 m above its bed and ≥ 12 m above `WATER_LEVEL`; 50 m east of the lake it is `WATER_LEVEL`; `withEscalera(t)` keeps it. `fishStepOk` true at the lake's centre. Sites: every core `inCorrupt`, in the Espinar or the Ceniza's edge (d 80–170 for 0, 2, 3); the wind core dry (height > lake surface) and within 8 m of the lake's edge; the stone core on the top terrace (height ≥ steps floor + 23); the thicket, the ash disc, the lake and the steps don't overlap; the Ceniza fogata is outside the ash disc. `thicketHurts` true in the ring, false on a bridged root line, false in the clearing, false outside. `ashHurts` inside r 35 only. `lidUp` with a pillar on the plate, with another player on it, not with nothing. Zones: `allZones` ends with 18–21, 18 at the tower (r 30), no overlap with 19–21; `isMountainZone(18) === false`.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(aventura): agua del Lago Negro, sitios de los Pilares-raíz y zonas 18–21 (reglas)`.

### Task 2: Server — the four pillars, zones, corruptSeen, lake water (protocol v47)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/shared/sim/marchito.ts` (`VISION`); Create `src/shared/sim/world-sim-s5c.test.ts`; Tests `protocol.test.ts`, `world-sim.test.ts` (version).

**Interfaces:**
```ts
// protocol.ts
| { t: 'pillar'; id: number }                      // id < 4
export interface PillarView { broken: boolean[]; roots: boolean[]; anchor: boolean; miasma: number; burns: number; lid: boolean }
// ServerMsg snap gains `pillars: PillarView`
// world-sim.ts SavedWorld gains pillars?: number[]; corruptSeen?: boolean
// marchito.ts VISION.corrupt(name), VISION.pillar[0..3](names)
```
- [x] **Step 1: failing tests** (`world-sim-s5c.test.ts`):
  - `decodeClient` accepts `pillar` 0–3, rejects 4/−1/"a". Version 47.
  - A living player in las Tierras sets `corruptSeen` (saved) with vision "Mi casa"; once only.
  - Thicket: standing in the ring loses ~10 PV/s; on a bridge after its root is tended, nothing. Enredadera within 3 m of a root → "Una raíz cruza las espinas (1/3)". Pull on core 0 with 2/3 roots → refused "Faltan raíces (2/3)"; with 3/3 → after 3 s broken, zone 19 clean, say "El Pilar-raíz de Enredadera se parte (1/4)", vision. Walking away mid-pull cancels.
  - Lake: a swimmer in the lake at the surface is accepted; the fish moves across the lake. The anchor (id 930_001, kind `'anchor'`) is in the snapshot; a hit from the surface is refused with "Bucea"; diving on the fish it takes damage; at 0 → "El núcleo sube…", `snap.pillars.anchor` false. Gusts on the shore core 3 × → miasma 3; pull → broken, zone 20 clean.
  - Ash: a walker within 35 m of the Fuego core loses ~4 PV/s; a deer rider doesn't. First approach spawns 3 rayos. 3 Llamaradas → burns 3; pull → broken, zone 21 clean.
  - Stone: pull with the lid down → "La tapa no se mueve…"; a Piedra pillar on the plate → pull works, no zone cleaned.
  - 4th pillar: "(4/4)". Broken pillars saved and reloaded; old saves without `pillars` load with none broken.
- [x] **Step 2: implement.** Replace `WATER_LEVEL` with `waterLevel(this.terrain, …)` in the fish and swim move checks, the fish's parked y and the dragon's ground. Thorn/ash damage in the vitals step (skip dead, flying, dungeons). `// S5-D` marker where the 4th pillar breaks. `snap.corrupt` includes 18–21.
- [x] **Step 3:** green, self-review, commit `feat(aventura): los 4 Pilares-raíz, zonas 18–21 y el agua del Lago Negro (protocolo v47)`.

### Task 3: La Flecha (rules + server, protocol v48)

**Files:** Modify `src/shared/sim/lieutenant.ts` + test, `src/shared/sim/wolves.ts` (`ENEMY.lieut3`, label, Wolf `aim?`, `aimFor?`, `dash?`, `stuck?`), `src/shared/protocol.ts`, `src/shared/sim/marchito.ts`, `src/shared/sim/world-sim.ts`; Tests.

**Interfaces:**
```ts
export const FLECHA = { hp: 360, damage: 12, every: 3, offset: 2, clavEvery: 7, clavRange: 20, tell: 1, dashSpeed: 20, dashDamage: 20, overshoot: 4, maxDash: 24, hitR: 1.2, stickR: 1.5, stuck: 4, thorns: 2, present: 40, behind: 12 } as const;
export function flechaLeads(raidN: number, corruptSeen: boolean, corrupt: readonly number[]): boolean; // seen && 18 corrupt && raidN % 3 === 2
export function clavadaStop(from, to, structures): { x: number; z: number; stuck: boolean };
export function stepFlecha(w, targets, structures, goal, terrain, dt, rng): { bite: string | null; hits: string[] };
```
- [x] **Step 1: failing tests.** Pure: `flechaLeads` truth table (2, 5, 8 → true; never together with `gataLeads`/`triLeads` for n = 1…30; false without seen or with 18 clean). `clavadaStop` stops at a wall on the line (stuck) and not at the Heart. `stepFlecha`: after 7 s with a player 10 m away → `aim` set for 1 s, then dashes and returns the player in `hits` once; a wall on the line leaves it `stuck` 4 s without moving. Sim: raid 2 with `corruptSeen`: warning "La Flecha guía el asedio esta noche", one `lieut3` with 360 PV, `WolfView.aim` during the tell; killing it: raid flees, +2 espinas near, none far, vision "Mi flecha". Version 48.
- [x] **Step 2: implement.**
- [x] **Step 3:** green, self-review, commit `feat(aventura): La Flecha guía asedios (protocolo v48)`.

### Task 4: Client — water, pillars, cracks, La Flecha

**Files:** Modify `src/client/movement.ts` (+ test), `src/client/game.ts`, `src/client/scene/villain-tower.ts`; Create `src/client/scene/pillars.ts`, `src/client/corrupt-ui.ts` + test.
- [x] **Step 1: failing tests.** `movement.test`: walking into the lake swims at its surface; the fish floats at the lake's surface. `corrupt-ui.test`: `pillarAction` gives "Arrancar el núcleo" within 2.5 m of a standing core, null when broken or far.
- [x] **Step 2: implement.** Lake disc at the surface (dark violet, no fog change); `scene/pillars.ts` (spikes, cores, thicket, roots → bridges, anchor chain, cocoon, lid/plate; broken → stump) inside the Tierras group; tower cracks (4 violet emissive strips, dark per broken pillar); contextual A + prompt; La Flecha `PaperActor('/enemies/enemy10.png', 3, camera, 463 / 437)` and a red ground line while `aim`.
- [x] **Step 3:** green, self-review, commit `feat(aventura): cliente de los Pilares-raíz, el Lago Negro y La Flecha`.

### Task 5: Ship

- [x] Push `aventura/resto`; append "Slice 5 · S5-C" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. No merge, no deploy.
