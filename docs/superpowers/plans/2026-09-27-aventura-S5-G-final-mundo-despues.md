# Aventura — Slice 5 · S5-G: el final y el mundo después — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S5-F left a marker `// S5-G` in `winFinal`: El Marchito falls, `ending = true`, a short vision — and nothing else changes. This plan is the payoff (spec §10). **On the kill:** everyone online gets the **long vision** (4 cards, 5 s each, skippable) and then the **credits** (a scrolling card, 25 s, skippable: "Bosque" · the names at the kill · "Dibujos: el sobrino" · "Hecho por Gabriel"); everyone in the Torre is put back at the Heart. Credits are shown **once per player** (`SavedPlayer.credits?`); whoever wasn't online gets them the **first time they log in after**, headed by "Mientras dormías, <nombres> vencieron a El Marchito". **The world after:** **all corruption zones 0–21 clean**; the villain's **tower turns white** (material swap, leaves on the tip); **el Guardián** (`public/enemies/enemy6.png`, El Marchito purified) stands 8 m east of the Heart, A near him says one of 6 lines; **la Grieta** — a 6 m walkable notch at `x = 0` through el Borde — opens for everyone (no more dragon-only). No invasion ever again.

**Override of the spec (Decidido por Claude — revisar, by the orchestrator):** the spec says raids **stop** by default and "Noches de desafío" turns them back on. Base defence is a core pillar and structures would become pointless, so **after the ending raids stay ON at reduced intensity** — wave × **0.6**, **no lieutenants** (their roots are clean), coming "from the north" with a new warning — and the world-level toggle at the Heart's **Menú** turns them **off** (and back on): "Noches de asedio: encendidas / apagadas". Server-validated (ending reached, alive, within the Heart's reach), saved as optional `SavedWorld.raidsOff?`.

**Architecture:** A new pure module `src/shared/ending.ts` (`ENDING`, `endingCards`, `creditLines`, `lateCards`, `GUARDIAN_LINES`, `guardianSpot`, `inGrieta`, `withGrieta`, `endingWave`) like `corrupt-lands.ts`. `rimCrossBlocked` learns an optional "grieta open" flag. `WorldSim.winFinal` resolves `// S5-G`; `connect` delivers late credits; `stepRaid`/`spawnRaiders` read `ending`/`raidsOff`. One new server message `{ t: 'ending'; cards; credits }` and one client message `{ t: 'raids'; on }`. The client reads `snap.ending`/`snap.raidsOff`: white tower, the Guardián paper by the Heart, the Grieta terrain wrapper (like `withEscalera`), the Menú toggle, and the card sequence in the HUD.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest 4, Cloudflare Workers + Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-27-aventura-slice-5-corrupcion-design.md` §10 (the ending), §3 (la Grieta in el Borde), §14 (names: `guardian`, `crack`, `credits`, `challengeNights`), §17 (row S5-G). HANDOFF S5-F "Victoria" and its `// S5-G` marker.

## Asset check (done while planning)

`public/enemies/enemy6.png` — a brown pentagon with a leaf crown and a smile; the spec measured 64 % alpha. Through `PaperActor`, **3 m tall** (spec §10.2), aspect from the image. No other art.

## Global Constraints

- Player-facing text in **Spanish**, dry voice. Names via `NAMES` (`guardian`, `crack`, `credits`, `villain`, `blackHeart`, `villainTower`). New name `raidNights: 'Noches de asedio'` (the spec's `challengeNights` is kept, unused, for the old meaning).
- **Phones first. No new keys or pills.** The cards skip with the existing `dismiss` (✕ / Enter). The Guardián's lines are the **contextual A / E** near him (client-only, no message). The toggle is a **Menú button**, shown only at the Heart after the ending.
- **Trust boundary:** the only new client message is `{ t: 'raids'; on: boolean }` through `decodeClient` (boolean checked). The server checks: `ending`, player alive, within `HEART.tendReach` of a live Heart; otherwise ignored with a toast.
- **Protocol:** Task 2 bumps `PROTOCOL_VERSION` 52 → 53 once for the whole plan (server msg `ending`, client msg `raids`, `snap.ending`, `snap.raidsOff`). New saved fields optional: `SavedWorld.endingNames?`, `SavedWorld.raidsOff?`, `SavedPlayer.credits?` — old saves load (an old `ending: true` save with no `endingNames` credits "vosotros").
- **[D] Cards:** 4 cards of 5 s (spec: "the Marchito shrinks, the Corazón Negro cracks, «Yo también era un bosque… <nombres>», the Guardián appears"). Enter / ✕ skips one card; the credits card scrolls for 25 s, ✕ closes it.
- **[D] Late credits:** any saved player without `credits` when the ending happens gets them on their next `connect` (after the `welcome`), with the "Mientras dormías…" line; players online at the kill but elsewhere (not in the Copa) get the normal sequence and are not listed as killers.
- **[D] Everyone back at the Heart:** players inside the Torre dungeon are moved next to the Heart (like a respawn position, not dead); everyone else stays where they are.
- **[D] All zones clean:** every zone id from `generateZones` goes into `cleansed` silently (one toast for all: "Todas las raíces marchitas se secan a la vez"). The white stumps / grey-green Ceniza are out of scope (the zone views already turn clean ones green; noted in the handoff as pulido).
- **[D] La Grieta:** band `|x| < 3` crossing el Borde. Terrain in the band = `min(base, footH + tan 30° · u)` where `u` = metres south of the rim's foot (`RIM_LINE − rim`): a notch cut at 30° from la Ceniza up into the mountains until it meets the ground. Walking the band is never rim-blocked once open. Server and client wrap the terrain with `withGrieta(base, () => ending)`.
- **[D] Raids after the ending (override):** on by default; wave = `ceil(normal × 0.6)`, no lieutenants (their zones are clean anyway), no coast brutes (the coast root is clean), no invasions. Warning: "Quedan bestias sueltas por el norte. Vuelvan al Corazón". Off: no warning, no raid, `raidLevel` doesn't grow. Toggling during a raid only affects the next dusk.
- **[D] Guardián:** 8 m east of the Heart, paper 3 m, no combat, no collision. A within 3 m cycles 6 lines (post-game hints: la Grieta, el Árbol-torre as "algún día", the toggle, the fogatas, the dragon, the Tierras' thorns).
- **Out of scope (noted):** the spec's **Árbol-torre** idea (§12: climbing the white tower) — the tower only turns white here; the Copa's painted backdrop.
- `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## File Structure

- Create `src/shared/ending.ts` + `src/shared/ending.test.ts`, `src/shared/sim/world-sim-s5g.test.ts`, `src/client/ending-ui.ts` + `src/client/ending-ui.test.ts`.
- Modify `src/shared/names.ts` (+ test if it lists keys), `src/shared/corrupt-lands.ts` (`rimCrossBlocked`), `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ version test), `src/client/movement.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/scene/villain-tower.ts`, `src/client/style.css`.

## Tasks

### Task 1: pure rules — cards, credits, la Grieta, the post-ending wave

**Files:** Create `src/shared/ending.ts`, `src/shared/ending.test.ts`; Modify `src/shared/corrupt-lands.ts`, `src/shared/names.ts`.

```ts
export const ENDING = { cardFor: 5, creditsFor: 25, raidMult: 0.6, guardian: { dx: 8, h: 3, reach: 3 }, grieta: { half: 3, deg: 30 } } as const;
export function endingCards(names: string): string[];          // 4 cards, the 3rd «Yo también era un bosque… <names>.»
export function creditLines(names: string): string[];          // 'Bosque', names, `Dibujos: ${NAMES.credits}`, 'Hecho por Gabriel'
export function lateCards(names: string): string[];            // ['Mientras dormías, <names> vencieron a El Marchito', ...]
export const GUARDIAN_LINES: readonly string[];                 // 6
export function guardianSpot(heart: { x: number; z: number }): { x: number; z: number };
export function inGrieta(x: number, z: number): boolean;
export function withGrieta(base: Terrain, open: () => boolean): Terrain;
export function endingWave(n: number): number;                  // ceil(n × 0.6), ≥ 1
// corrupt-lands.ts
export function rimCrossBlocked(pz: number, nz: number, nx?: number, grieta?: boolean): boolean;
```

- [ ] **Step 1: failing tests.** 4 cards, the names in the 3rd, the Guardián named in the 4th; credits start "Bosque", include the names, `NAMES.credits`, "Hecho por Gabriel"; late cards start "Mientras dormías, Ana y Bea vencieron a El Marchito". 6 distinct Guardián lines. `guardianSpot` 8 m east. `inGrieta` at `(0, RIM_LINE − 5)` true, `(10, …)` false. `withGrieta` closed = base; open: in the band never above base, at the rim's foot equal to base, and the band's slope ≤ 31° everywhere a walker would climb (probe north→south); outside the band = base. `rimCrossBlocked(pz, nz)` unchanged; with `nx = 0, grieta = true` false; with `nx = 10, grieta = true` true. `endingWave(10) = 6`, `endingWave(1) = 1`. Names test: no hand-written "Guardián"/"Grieta".
- [ ] **Step 2: implement.**
- [ ] **Step 3:** green, self-review, commit `feat(aventura): reglas puras del final y la Grieta`.

### Task 2: the ending on the server (protocolo v53)

**Files:** Modify `src/shared/protocol.ts` (+ test), `src/shared/sim/world-sim.ts` (+ version test); Test `src/shared/sim/world-sim-s5g.test.ts`.

- [ ] **Step 1: failing tests.** Kill the core (the S5-F helper): every online player gets `{ t: 'ending' }` with 4 cards (names of those in the Copa) and credits; `save().endingNames` = those names; their `credits` flag set; players in the Torre are at the Heart (≤ 6 m); `corrupt` in the snapshot is `[]` and `save().cleansed` has every zone id; `snap.ending` true. A saved player who was offline connects later → after `connect` the outbox has an `ending` for them whose first card starts "Mientras dormías"; connecting again → nothing. Old save with `ending: true` and no `endingNames` loads. La Grieta: before the ending a ground move across the rim at x 0 is refused ("…Solo volando"); after, it's accepted at x 0 and refused at x 20. No invasion 2 starts after the ending even if pending. `decodeClient` accepts `{t:'raids',on:true}`, refuses `on:'x'`. Protocol 53.
- [ ] **Step 2: implement** (`winFinal`: cards + credits msg to online, `endingNames`, `credits`, cleanse all, move Torre players home, `// S5-G` gone; `connect` late credits; `withGrieta` in the constructor's terrain; `rimCrossBlocked(p.z, m.z, m.x, this.ending)`; guards on invasions; snapshot `ending`, `raidsOff`; `decodeClient` `raids`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): el final — visión larga, créditos, zonas limpias y la Grieta (protocolo v53)`.

### Task 3: raids after the ending and the Menú toggle

**Files:** Modify `src/shared/sim/world-sim.ts`; Test `world-sim-s5g.test.ts`.

- [ ] **Step 1: failing tests.** After the ending at dusk: warning "Quedan bestias sueltas por el norte…", at night the wave is `endingWave(normal)` and has no `lieut*`. `{t:'raids',on:false}` at the Heart → `raidsOff`, toast to all "Noches de asedio: apagadas", saved; next dusk no warning and no wolves; `on:true` brings them back. Refused (with a toast, no change) before the ending, away from the Heart, or dead. Old saves: `raidsOff` absent → on.
- [ ] **Step 2: implement** (`raidsOff` field + save/load, `onRaids`, `stepRaid` gate + text, `spawnRaiders` multiplier and no lead).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): asedios tras el final, más suaves, y el interruptor del Corazón`.

### Task 4: client — cards, credits, white tower, el Guardián, la Grieta, the toggle

**Files:** Create `src/client/ending-ui.ts` (+ test); Modify `src/client/hud.ts`, `src/client/game.ts`, `src/client/movement.ts`, `src/client/scene/villain-tower.ts`, `src/client/style.css`.

- [ ] **Step 1: failing tests** (`ending-ui.test.ts`): `guardianAction(pos, heart, ending)` → "Hablar con el Guardián" within 3 m of the spot after the ending, else null; `nextGuardianLine(i)` cycles the 6; `raidsMenu(ending, atHeart, off)` → null before the ending / away, else `{ label: 'Noches de asedio: encendidas', on: false }` (the click flips); movement: a walker body crossing the rim at x 0 with the Grieta open is not stopped.
- [ ] **Step 2: implement** (HUD `showEnding(cards, credits)`: one card at a time, 5 s each, `dismiss` skips; then a scrolling credits card 25 s; `game.ts` handles `ending`, keeps `ending`/`raidsOff` from the snapshot, rebuilds the terrain once with `withGrieta`, passes the flag to `stepBody`; `VillainTower.setWhite()`; the Guardián `PaperActor` (enemy6, 3 m) by the Heart; the contextual A line; the Menú button sends `{t:'raids', on}`).
- [ ] **Step 3:** green, self-review, commit `feat(aventura): cliente del final — tarjetas, créditos, torre blanca y el Guardián`.

### Task 5: Ship

- [ ] Full suite green; `git push origin aventura/resto`; append "## Slice 5 · S5-G — …" to the HANDOFF; one short comment on PR #3.
