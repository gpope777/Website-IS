# Aventura — Slice 3 · S3-C: santuarios del Pantano, ámbar y Capa de corteza — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three swamp shrines (ids 6–8 after the coast's 3–5). **Candiles** (montículo): 3 braziers around the gate, all lit at once (each stays lit 12 s) opens it; without Fuego a **torch post** by the gate gives a torch with A, A at a brazier lights it. **Nenúfares** (Laguna Negra's edge): the orb stands on a low stone platform ~30 m out over deep water; **7 lily pads** lead there and sink 1.5 s after someone stands on them (back up 4 s later); standing on the last pad opens the gate; the frog's high jump crosses in ~3 hops. **Turba** (the mound nearest the Laguna): the gate is a wall of peat roots that **only Fuego** burns — a "vuelve luego" shrine now. **6 amber trees** on montículos (2 on +6 m bare stumps: frog jump only): A harvests **2 ámbar**, regrows after 2 in-game days, per player. Swamp orbs also give **1 ámbar**. At the Heart, **Capa de corteza** levels 1–3 (3 ámbar + 10 madera + 5 bayas each): −10 % damage taken per level from bites and falls (never the Zarzal/Ciénaga terrain bite).

**Architecture:** Swamp shrines and amber trees are seeded in a new `src/shared/swamp-shrines.ts` (`generateSwampShrines`, `generateAmberTrees`, `lilyPadCrags`) and appended to the same `Shrine[]` list, so beams, orbs, stamina and "one orb per player" reuse the existing code. New `ShrineKind`s `'candles' | 'lilies' | 'peat'`. Nenúfares uses `Shrine.pillar` (a bare, low stone platform) so the orb reach and "stand on it" already work; floating pads are bare `Crag`s added to `climbables()` (server) and the client's climb list while up. Amber is a new `ItemId`; `CAPA` + `capaMult(lvl)` live in `items.ts` next to `UPGRADE`. Live-only: brazier lit-until times, who carries a torch, pad sink/rise times. Saved (optional, old saves load): `SavedPlayer.amber?: Record<number, number>` (tree id → sim time harvested), `SavedPlayer.capaLvl?: number`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-3-pantano-design.md` §6.1, §6.2, §6.3, §14.2, §15 (row S3-C).

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`NAMES.amber`, `NAMES.capa`, `NAMES.powerFire`, `NAMES.heart`, `NAMES.frog`).
- **Phones first. Touch grid stays at 10 pills.** Everything is the contextual **A** (keyboard E): take a torch, light a brazier, harvest amber, buy a Capa level. Pads need no button (you stand on them).
- **Trust boundary:** every client message through `decodeClient`; the server checks reach, torch holder, stump height (`p.y ≥ top − 1`), per-player regrow, costs and the Capa cap.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 24 → 25 (`shrine` part ≤ 4, `SelfState.torch`); Task 3 bumps 25 → 26 (`amber`, `capa` messages, `SelfState.amber`, `SelfState.capa`, `PlayerView.capa`). New saved fields optional only.
- **Fuego does not exist yet (S3-E).** Built and visible now: braziers (lit by torches), the peat wall (never opens yet: "Raíces de turba. Esto solo arde. Vuelve luego"). The Llamarada paths (brazier, peat wall 3 casts) are `// S3-E` markers.
- **Swamp corruption does not exist yet (S3-D).** A swamp orb cleanses nothing (and must not cleanse a coast zone, which the current `id >= 3` rule would do): `// S3-D` marker.
- **[D] The torch does not slow you** (same as the pumice/root block: a speed cap needs client prediction). Instead **each torch is spent on one brazier**: solo means three trips to the post inside 12 s — possible for a fast runner, easy with two. Revisar tras jugar.
- **[D] Frog over deep water:** the frog may be over any water while airborne (`y > WATER_LEVEL + 0.5`), on a pad or on the platform; landing in deep water it may only move toward shallower water (mirror of the swimmers' rule). Server and client.
- **[D] Heart A priority:** tend (damaged Heart) → weapon upgrade (if affordable) → Capa.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines.

---

### Task 1: Swamp shrines, amber trees, amber item and the Capa (shared)

**Files:** Create `src/shared/swamp-shrines.ts`, `src/shared/swamp-shrines.test.ts`; Modify `src/shared/shrines.ts` (kinds + labels), `src/shared/items.ts` (`amber`, `CAPA`, `capaMult`); Test `items.test.ts`.

**Interfaces:**
```ts
export type ShrineKind = ... | 'candles' | 'lilies' | 'peat';
// Shrine.parts: candles = [brazier, brazier, brazier, torch post]; lilies = 7 pads (shore → platform); peat = []
export const SWAMP_SHRINE = { firstId: 6, brazierR: 7, litFor: 12, postGap: 2.5, pads: 7, padR: 1.1, padTop: 0.15, sinkAfter: 1.5, downFor: 4, platformR: 3, platformTop: 1, reachOut: 30, padId: 1200 } as const;
export function generateSwampShrines(t: Terrain, seed: number): Shrine[]; // ids 6,7,8
export function lilyPadCrags(s: Shrine, up: readonly boolean[]): Crag[]; // bare discs for pads still up
export const AMBER = { trees: 6, high: 2, stumpH: 6, stumpR: 1.6, reach: 2.5, yield: 2, regrowDays: 2, orb: 1, stumpId: 1100 } as const;
export interface AmberTree { id: number; x: number; z: number; y: number; stump: Crag | null }
export function generateAmberTrees(t: Terrain, seed: number): AmberTree[];
// items.ts
export type ItemId = 'wood' | 'stone' | 'berries' | 'pearl' | 'amber';
export const CAPA = { cost: { amber: 3, wood: 10, berries: 5 }, step: 0.1, max: 3 } as const;
export function capaMult(lvl: number): number; // 1 − 0.1 × clamp(lvl, 0, 3)
```
- [ ] **Step 1: failing tests.** For 4 seeds: 3 swamp shrines, ids 6/7/8, kinds candles/lilies/peat, same list for the same seed. Candles: in the swamp, on a montículo (not the frog's), orb, 3 braziers (pairwise 10–14 m) and the post all dry. Lilies: platform (a bare pillar, r 3) whose centre and rim are deeper than `SWIM_MAX_DEPTH + 0.5`; 7 pads over water, consecutive gaps ≤ 5 m, first pad within 4 m of water shallower than 1 m, last pad ≤ 5 m from the platform rim, the whole path ≥ 12 m from the Laguna centre. Peat: on a dry montículo, not the others'. `lilyPadCrags` returns only up pads, bare, top `WATER_LEVEL + 0.15`. 6 amber trees on distinct montículos, not the frog's or a shrine's, dry; exactly 2 with a bare stump (top = ground + 6). `capaMult(0)=1`, `(3)=0.7`, `(9)=0.7`; `ITEM_LABELS.amber` from `NAMES.amber`.
- [ ] **Step 2: implement** (`createRng(seed ^ 0x5a4b)`; mounds from `swampFeatures`; platform along a seeded ray toward the west half of the Laguna, bounded tries, fallback straight west).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios del Pantano, ámbar y capa (reglas)`.

### Task 2: Swamp shrine puzzles on the server + frog over the pads (protocol v25)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`, `src/shared/frog.ts` (`frogStepOk` gains the deep-water rule), `src/client/movement.ts` (frog: airborne / pads / shallower); Tests `protocol.test.ts`, `world-sim.test.ts`, `frog.test.ts`, `movement.test.ts`.

- [ ] **Step 1: failing tests.** `decodeClient` accepts shrine part 4, rejects 5. `sim.shrines` has 9 (old "6 shrines" test updated: intentional). **Candiles:** part 4 at the post gives a torch ("Una antorcha. A junto a un brasero"), a second one is refused while carrying; part 1–3 at a brazier with a torch lights it for 12 s and spends the torch; without a torch → "Hace falta fuego"; all three lit at once opens the shrine; the torch drops (is lost) on death. **Nenúfares:** a player standing on a pad sinks it after 1.5 s (view part false), it comes back 4 s later; standing on the last pad opens the shrine for 30 s; the orb on the platform is taken with the gate open. `climbables()` includes pads that are up. **Turba:** never open; orb → "Raíces de turba. Esto solo arde. Vuelve luego". A swamp orb gives +1 ámbar and cleanses no zone. **Frog:** a frog rider move over deep water is accepted while airborne or on a pad, refused when floating deeper unless it gets shallower.
- [ ] **Step 2: implement** (`shrineLive` gains `lit: number[]` and `sink: {at, up}` per pad; `Live.torch`; `stepShrines` handles lilies; `// S3-E` markers for Llamarada on braziers and the peat wall; `// S3-D` marker for swamp cleansing).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): santuarios del Pantano en el servidor (protocolo v25)`.

### Task 3: Amber trees and the Capa de corteza on the server (protocol v26)

**Files:** Modify `src/shared/protocol.ts`, `src/shared/sim/world-sim.ts`; Tests `protocol.test.ts`, `world-sim.test.ts`.

**Interfaces:**
```ts
// ClientMsg: { t: 'amber'; id: number } | { t: 'capa' }
// SelfState: torch: boolean; amber: number[] (tree ids still regrowing for you); capa: number
// PlayerView: capa: number
// SavedPlayer: amber?: Record<number, number>; capaLvl?: number
```
- [ ] **Step 1: failing tests.** Decode `amber` (integer id) and `capa`. A player at a tree (reach 2.5) gets 2 ámbar ("Ámbar: 2"), again → "Aún no ha vuelto a brotar"; after 2 × DAY_LENGTH it works again; another player harvests their own. A stump tree needs `p.y ≥ stump.top − 1`. `climbables()` includes stumps. Capa near the Heart with 3 ámbar + 10 madera + 5 bayas → `capa` 1, cost removed, toast; without → "Faltan materiales"; far → nothing; at 3 → "La capa ya no admite más corteza". A wolf bite of 10 with Capa 3 → 7; the Zarzal bite unchanged. Old saves without `amber`/`capaLvl` load (0).
- [ ] **Step 2: implement** (`bite` and the coast chasm fall × `capaMult`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): árboles de ámbar y Capa de corteza (protocolo v26)`.

### Task 4: Client — swamp shrines, amber, Capa

**Files:** Create `src/client/swamp-ui.ts` + `swamp-ui.test.ts`, `src/client/scene/amber.ts`; Modify `src/client/coast-ui.ts` (`shrinePartAt`: braziers/post), `src/client/scene/shrines.ts` (braziers with flames, torch post, pads that sink, peat wall), `src/client/game.ts` (shrine list concat, pads + stumps in the climb list, amber and Capa in `act` + prompts, torch in hand), `src/client/hud.ts` (Capa level in the inventory line), the player actor (bark tint by `capa`).

- [ ] **Step 1: failing tests.** `swampAction`: near a ready amber tree → `{amber id, 'Recoger ámbar'}`; regrowing / below a stump top → null; at the Heart with ≥3 ámbar and capa < 3 → `{capa, 'Capa de corteza (3 ámbar, 10 madera, 5 bayas)'}`; capa 3 → null. `shrinePartAt`: post → "Coger una antorcha"; brazier with a torch → "Encender el brasero", without → "Hace falta fuego".
- [ ] **Step 2: implement.** Braziers: stone bowl + emissive flame cone shown while lit (no real lights). Pads: instanced-free (7 discs), lowered 0.6 m while sunk. Peat wall: brown cylinder instead of the light gate. Amber trees: dark trunk + orange emissive blob (visible in fog), dim while regrowing for you; stumps via `buildCrags`. Torch: small emissive cone on the player's hand while carrying.
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente de santuarios del Pantano, ámbar y capa`.

### Task 5: Ship

- [ ] Push `aventura/resto`; append "Slice 3 · S3-C" to `docs/superpowers/HANDOFF-aventura.md`; one short comment on PR #3. No merge, no deploy.
