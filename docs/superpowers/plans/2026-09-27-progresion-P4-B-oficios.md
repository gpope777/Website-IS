# Progresión · P4-B: Oficios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the second plan of subproject #4 (spec §4, row P4-B of §11). Each Rango 2–8 gives **1 punto de Oficio** (7 in all) to spend on **12 passive oficios** in 3 branches of 4 (Andar, Oficio, Compañía), bought **in order** within a branch. **Olvidar oficios** at the Heart costs 5 bayas and gives every point back. Each effect lives in its existing site; the movement ones are applied on the client **and** in the server's move validation so legit moves are never rejected. A new **Oficios** screen in the Menú (3 columns × 4 buttons). Nothing touches damage, health, defence, walking speed, i-frames, powers or the Heart.

**Architecture:** pure `SKILLS`, `skillCost`, `canLearn`, `hasSkill`, `SKILL_FX` in `src/shared/progression.ts`. `WorldSim` handles `{ t: 'learn', id }` and `{ t: 'forget' }`, saves `SavedPlayer.skills?: string[]`, and sends `SelfState.skills`. Server effects read `hasSkill(p, id)`. The client copies `self.skills` onto its `Body` (`Body.skills`) so `stepBody` applies glide/stamina/climb/mount multipliers; the Oficios panel is pure HTML built by `src/client/skills-ui.ts`.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-progresion-design.md` §4 (Oficios), §10.1–10.2, §11 (P4-B).

## Global Constraints

- Spanish, dry voice. `NAMES.skills = 'Oficios'` and the 12 oficio names in `names.ts`; code uses `NAMES`.
- **No new keys or pills.** Everything goes through the Menú (Esc / MENÚ pill) → "Oficios".
- **Trust boundary:** two new client messages through `decodeClient` (`learn` with a known id, `forget`). The server re-checks points, branch order, the Heart's reach and the 5 bayas.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 55 → 56 (`SelfState.skills`, messages `learn` / `forget`). New saved field optional: `SavedPlayer.skills?`. Old saves load with no oficios and all their points free.
- **[D] Effects adapted to what the code really has** (the spec guessed at a few mechanics):
  - **Pies ligeros:** walking/running never costs aliento in this game → *el aliento vuelve un 25 % más rápido* (`STAMINA.regen` ×1,25).
  - **Planeo largo:** `GLIDE.sink` ×0,8 (1,6 → 1,28). The server never checks sink rate (a move that goes down always passes), so nothing to widen; a test proves a slower glide is accepted.
  - **Pulmón:** there is no breath meter on foot (only the fish dives) → *nadar rápido gasta la mitad de aliento* (`STAMINA.swimFast` ×0,5).
  - **Trepador:** climbing (crags and mountain rock, holding, moving and the leap) costs −25 %; on wet rock you may still grab and climb at half `CLIMB_SPEED`. The server lets a trepador's moves onto wet climbable rock through (`climbableAt(…, wet && !trepador)`).
  - **Mano buena:** tree/rock/bush give +1 (wood, stone, berries only).
  - **Fogatero:** `FOGATA.channel` 5 s → 2 s for fogata trips (server; the client text reads the number from `self`/toast).
  - **Trampero:** spikes and roots you build get +30 % hp (they last 30 % longer: wear is per touch).
  - **Buen ojo:** amber and quartz regrow in 1 day instead of 2, for you (server and the self regrowing lists).
  - **Mano amiga:** revive is instant here → *levantas a un amigo desde el doble de lejos* (`REVIVE.reach` ×2).
  - **Silbido:** call mounts from any lit fogata (server `onCall` + client `fogataCalls`).
  - **Mochila honda:** the grave already keeps the whole inventory → *tu tumba vuelve a ti a 10 m* (pickup radius 2 → 10).
  - **Pastor:** your deer / Estrella and frog run +10 % (client speeds and the server's riding caps).
- **Forget:** only within `HEART.tendReach` of a Heart, 5 bayas, frees every point; no limit. Rango drops never happen (Savia only grows), so skills are never over budget except by a hand-edited save — then `learn` just refuses.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Modify `src/shared/progression.ts` (+ test), `src/shared/names.ts` (+ test), `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts`, `src/client/movement.ts` (+ test), `src/client/swamp-ui.ts` (+ test), `src/client/game.ts`, `src/client/hud.ts`.
- Create `src/shared/sim/world-sim-p4b.test.ts`, `src/client/skills-ui.ts` + `.test.ts`.

## Tasks

### Task 1: pure rules — the 12 oficios

```ts
export type SkillId = 'pies' | 'planeo' | 'pulmon' | 'trepador' | 'mano' | 'fogatero' | 'trampero' | 'ojo' | 'amiga' | 'silbido' | 'mochila' | 'pastor';
export const BRANCHES: readonly { name: string; skills: readonly SkillId[] }[]; // Andar, Oficio, Compañía
export const SKILL_FX = { regen: 1.25, sink: 0.8, swimFast: 0.5, climb: 0.75, wetClimb: 0.5, harvest: 1, channel: 2, trap: 1.3, regrowDays: 1, reviveReach: 2, gravePickup: 10, mount: 1.1, forgetCost: 5 } as const;
export const isSkill(id: unknown): id is SkillId;
export function hasSkill(p: { skills?: readonly string[] } | undefined, id: SkillId): boolean;
export function skillPoints(rank: number, skills: readonly string[] = []): number; // pointsOf(rank) − owned
export function canLearn(skills: readonly string[], id: SkillId, rank: number): 'ok' | 'owned' | 'order' | 'points';
```

- [ ] **Step 1: failing tests.** 12 unique ids, 3 branches of 4; `canLearn([], 'planeo', 8)` → `'order'`; `canLearn([], 'pies', 1)` → `'points'`; `canLearn(['pies'], 'planeo', 3)` → `'ok'`; owned → `'owned'`; `skillPoints(8, 7 skills)` = 0; `hasSkill(undefined, 'pies')` false; `NAMES.skills` and a name for every oficio.
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(progresion): reglas puras de los Oficios`.

### Task 2: server — learn, forget and the server-side effects (protocolo v56)

- [ ] **Step 1: failing tests** (`world-sim-p4b.test.ts`). Protocol 56; `decodeClient` accepts `learn` with a known id, rejects an unknown one, accepts `forget`. A Rango 3 player learns `pies` then `planeo` (saved, in `self.skills`); a third is refused ("Sin puntos"); `trepador` before `pulmon` is refused. `forget` away from the Heart does nothing; at the Heart with 4 bayas refuses; with 5 clears the skills and spends 5. Effects: *Mano buena* harvest +1; *Fogatero* channel lands in 2 s; *Buen ojo* amber again after 1 day; *Mano amiga* revives from 4 m; *Silbido* calls from a lit fogata that is not la Ceniza; *Mochila honda* picks up the grave at 8 m; *Trampero* spikes hp ×1,3; *Pastor* a rider's move at `MOUNT.maxSpeed × 1,08` passes; *Trepador* a move up wet climbable rock passes (and fails without it); *Planeo largo* a slow glide down passes.
- [ ] **Step 2: implement** (`onLearn`, `onForget`; `hasSkill` at each site; `SelfState.skills`).
- [ ] **Step 3:** green (adapt 55 → 56 in version tests, noted), self-review, commit `feat(progresion): Oficios en el servidor (protocolo v56)`.

### Task 3: client movement — the Andar oficios and Pastor on the body

- [ ] **Step 1: failing tests** (`movement.test.ts`): with `Body.skills = ['pies','planeo']` a glide sinks at 1,28; regen is ×1,25; with `pulmon` fast swimming spends half; with `trepador` climbing spends −25 % and a wet wall can be grabbed; with `pastor` riding runs `MOUNT.run × 1,1`. `fogataCalls` with Silbido offers calls at any lit fogata.
- [ ] **Step 2: implement** (`Body.skills?`; `game.ts` copies `self.skills`; `fogataCalls(…, silbido)`).
- [ ] **Step 3:** green, self-review, commit `feat(progresion): los Oficios de Andar en el cliente`.

### Task 4: the Oficios screen in the Menú

- [ ] **Step 1: failing tests** (`skills-ui.ts`): `skillsHtml(rank, skills, atHeart, berries)` has "Puntos: N", 3 columns × 4 buttons, owned ones marked `owned`, the next learnable `open`, the rest `locked`; "Olvidar oficios · 5 bayas" only at the Heart; `skillLine(id)` gives the phrase.
- [ ] **Step 2: implement** (Menú button "Oficios" → panel; tap a oficio → its phrase + "Aprender (1 punto)" → `{ t: 'learn', id }`; forget → `{ t: 'forget' }`; "Volver").
- [ ] **Step 3:** green, self-review, commit `feat(progresion): pantalla de Oficios en el Menú`.

### Task 5: Ship

- [ ] Full suite green; push; HANDOFF "## Progresión · P4-B — …"; one short comment on PR #3.
