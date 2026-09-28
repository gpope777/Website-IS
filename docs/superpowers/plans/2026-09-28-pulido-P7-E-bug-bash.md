# Pulido · P7-E: Bug-bash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-E of the spec's plan map (§14): fix the "Arreglar" rows of the triage (§10.1) that earlier P7 plans did not already close, and the trivial balance list (§10.2) in **its own commit**. Concretely: (1) the real mount's name when the land mount is la Estrella (the Ceniza call, the fogata Menú, "no está cerca"); (2) a **full moon you can see** (a big disc on `día % 8 === 0` nights); (3) **la Copa's painted backdrop** (one cylinder, gradient + map silhouette painted on a canvas, 1 draw call) and **the Raíces-madre turning to white stumps** after the ending; (4) **pose numbers** (bow arm aims low, slide floats) and the own robot's night lift (+ a little emissive with the moon rim); (5) balance: **El Marchito's final fight solo** and **8 s between fish rings**.

**Architecture:** pure, tested helpers next to the data they read: `mountName`/`callText` in `src/shared/corrupt-lands.ts`, `moonLook(day)` in `src/client/scene/sky-dome.ts`, `copaSkyline(seed)` + `stumpTint(k)` in a new `src/client/scene/backdrop.ts`, numbers in `src/client/actors/poses.ts`, `FINAL.soloFactor` in `src/shared/sim/marchito-final.ts`, `FISH.ringTime` in `src/shared/fish.ts`. The 3D bits are wired in `game.ts`, `tower-dungeon.ts` and the four dungeon trunk classes.

**Tech Stack:** TypeScript, three.js 0.185, Vite, Vitest 4, Playwright (screenshots only; `npm run perf -- --vitrina`).

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §10.1, §10.2, §14 (P7-E). Slice 5 spec §10 ("root-mothers become white stumps; the Tierras' ash tint lightens to grey-green").

## What the triage leaves for P7-E (checked against the HANDOFF)

| §10.1 row | State before P7-E | P7-E |
|---|---|---|
| Telón pintado de la Copa | missing (S5-F, S5-G) | **Task 3** |
| Raíces-madre tocones blancos / Ceniza verde-gris | Ceniza: **already done** by V2-C (las Tierras turn to meadow from la Torre, `purify`); stumps: missing | **Task 3** (stumps only) |
| Luna en el cielo | V2-B drew a tiny moon every night; nothing special on full moon | **Task 2** |
| "Ciervo" with la Estrella (call + fogata Menú) | still "ciervo" | **Task 1** |
| Poses toscas (arco bajo, deslizar) | as V2-E left them | **Task 4** |
| Robot de noche = silueta negra | V2-E added the moon rim to every robot (own included) | **Task 4**: + small night lift |
| Cámara, Menú spoilers, visiones por jugador, `qty` | done in P7-A / P7-C | — |
| Sombra de criaturas en pose quieta, trueques en memoria, asedios tras el final | won't fix / leave (spec) | — |
| Cornisa (repisas vs salto de rana), ancho de la Escalera | not in §10.1: "Qué probar" items with no bug evidence | **Deferred** to Gabriel's test (§12) |

## Global Constraints

- **No protocol change** (stays 64): every fix is client text, client rendering or a server constant. Old saves load untouched.
- **Balance only in Task 5, one commit**, easy to revert. Tests that pinned a changed number are updated to the new rule (noted), never weakened; the solo-time simulation keeps its 6–10 min window.
- Perf: at most +2 draw calls in the Copa (backdrop) and 0 elsewhere; `npm run perf -- --tier low` must stay within budget/base.
- Spanish player-facing text, dry voice, no exclamations. `npm test && npm run test:workers && npm run check && npm run build` before every commit; commits end with the Co-Authored-By + Claude-Session lines; push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] El Marchito solo: the spec says "voluntad +30 % en solitario en `FINAL`"**, but *voluntad* is the Invasion stat (`MARCHITO` in the Slice 2 invasions); the ~6 min problem is the **final fight** (S5-F: simulated solo **6,1 min**: phase 1 139 s, phase 2 92 s, phase 3 135 s; target ~8). Phase 2 is a fixed number of brotes (HP-independent), so the knob is his **PV when fought alone**: `FINAL.soloFactor = 1.3` replaces `finalFactor(1) = 1` (body 1 200 → 1 560, core 300 → 390). Measured with the existing scripted player: **~7,7 min** (177 / 92 / 196 s). With 2+ the factor stays 1 + 0,35 × (n − 1) (so 2 players = 1,35: barely more than solo, which is fine — two players hit twice as hard).
- **[D] Pez: 7 → 8 s** between rings. Evidence: rings are 10–14 m apart, the counted radius is 2,2 m, plain swimming is 2,2 m/s → the worst gap takes 5,4 s in a straight line, and fast swimming (4 m/s) drains 12 aguante/s, so a kid swimming normally has ~1,5 s to turn. One constant.
- **[D] Curva de Savia: not changed.** §10.2 says: move it if the full-story simulation reaches Rango 8 before El Marchito, or never reaches it. There is no such simulation with kills; the milestone-only test gives ~1 270 (Rango 6), and the curve needs the living part (hunts, raids, zones) that only a real playthrough measures. Left to Gabriel's test.
- **[D] Mount name**: `landMount(star)` → "la Estrella" / "el ciervo"; the call text "Silbas. La Estrella llega rodando por la ceniza"; fogata Menú "Llamar a la Estrella"; "La Estrella no está cerca". The server reads `p.star`, the client its `hasStar`.
- **[D] Full moon**: the sky shader's moon gets a `uMoon` uniform: normal nights keep today's small disc; on full-moon nights (`día % 8 === 0`) the disc is ~2,5× wider, brighter and with a soft halo. Pure `moonLook(day)` → `{ size, glow }`. Visible whether or not the ending happened (the Estrella only comes after it; the moon is just the moon).
- **[D] Copa backdrop**: an open cylinder (r 70 m, 40 m tall, 32 sides, inside faces, `fog: false`, basic material) around la Copa with a 1024×256 canvas texture: a vertical gradient (the Tierras' dusk sky: violet at the top → pale amber at the horizon) and **three silhouette bands** from `copaSkyline(seed)` — far mountains (blue-grey), the forest's treeline (dark green), and the Heart's tree as one spike to the south. Painted once. After the ending the canvas is not repainted (the Copa is empty then).
- **[D] White stumps**: after the ending, each Raíz-madre's trunk lerps its bark to bone white (`0xe8e2d4`) as the world's `purify` goes 0 → 1 (same 60 s as the Tierras), its purple hollow and sky beam fade out. Materials are per-class shared constants today; each dungeon mesh gets its own trunk material clone so the interior walls keep their colour. `stumpTint(k)` pure. They are not cut down (the geometry stays; "tocón" is the look, the trunk still marks the place).
- **[D] Poses**: numbers re-solved against `robot.glb` with a small FK script (kept in `scratch/pose/`, not shipped): bow = elbow at shoulder height, palm ~0,3 m above the shoulder straight ahead; slide = the body's middle at ~0,3 m instead of 1,25 m (`rootY` −0,55). Night lift: the rim patch adds `diffuse × 0,08 × rimK/0,55` (≈ +0,05 of emissive at full night).

## File Structure

- Modify `src/shared/corrupt-lands.ts` (+test), `src/client/swamp-ui.ts` (+test), `src/shared/sim/world-sim.ts`, `src/client/game.ts`.
- Modify `src/client/scene/sky-dome.ts` (+`sky-dome.test.ts`), `src/client/scene/sky.ts`.
- Create `src/client/scene/backdrop.ts` (+`backdrop.test.ts`); modify `src/client/scene/tower-dungeon.ts`, `dungeon.ts`, `coast-dungeon.ts`, `swamp-dungeon.ts`, `mountain-dungeon.ts`.
- Modify `src/client/actors/poses.ts` (+test), `src/client/scene/patches.ts`.
- Modify `src/shared/sim/marchito-final.ts` (+test), `src/shared/sim/world-sim-s5f.test.ts`, `src/shared/fish.ts` (+test if pinned).

## Tasks

### Task 1: the real mount's name (Estrella)

```ts
// corrupt-lands.ts
export function landMount(star: boolean): string;            // 'la Estrella' | 'el ciervo'
export function callText(beast: CallBeast, star: boolean): string;
export function callNone(beast: CallBeast, star: boolean): string;
// swamp-ui.ts
export function callLabel(beast: CallBeast, star: boolean): string;
```

- [ ] **Step 1: failing tests.** `callText('deer', true)` names la Estrella and never "ciervo"; `('deer', false)` is today's text; frog/fish unchanged; `callLabel('deer', true)` = "Llamar a la Estrella". World-sim: a player with `star` calling from the Ceniza fogata is told the Estrella line.
- [ ] **Step 2: implement** (server `onCall`, client fogata Menú, the "no está cerca" toast). **Step 3:** green, commit `fix(pulido): la Estrella se llama la Estrella al silbar y en las fogatas`.

### Task 2: the full moon

- [ ] **Step 1: failing test.** `moonLook(8)` is larger and brighter than `moonLook(9)`; `moonLook(0)` full; normal nights = today's values.
- [ ] **Step 2:** `uMoon`/`uMoonGlow` uniforms in the dome shader, `DayLight.update(..., day)`; `game.ts` passes the day. Screenshot at night on day 8 vs 9 (harness world with the time set). **Step 3:** green, perf equal, commit `fix(pulido): luna llena en el cielo`.

### Task 3: la Copa's backdrop and the white Raíces-madre

- [ ] **Step 1: failing tests.** `copaSkyline(seed)` gives 3 bands of N heights in [0, 1], deterministic, the forest band lower than the mountains, one spike band; `stumpTint(0)` = bark, `stumpTint(1)` = bone white, beam opacity 0 at 1.
- [ ] **Step 2:** `backdrop.ts` builds the cylinder + canvas once (`CanvasTexture`, skipped when `document` is missing); `tower-dungeon.ts` adds it around the Copa. Each dungeon class gets `setPurify(k)`; `game.ts` calls it with `this.purify`. Screenshot: la Copa (player placed in the Copa via an imported world) and a Raíz-madre with `purified` stop. **Step 3:** green, perf within budget, commit `fix(pulido): telón de la Copa y Raíces-madre blancas tras el final`.

### Task 4: poses and the robot at night

- [ ] **Step 1: failing tests.** bow: the solved numbers (left elbow raised: `UpperArmL[0] > 0.3`); slide lies low (`rootY < -0.4`, `rootX` still > 1.2). Rim patch source contains the night lift.
- [ ] **Step 2:** numbers from `scratch/pose/solve.mjs`; rim lift in `patchRim`. Screenshots `npm run perf -- --vitrina pose:bow,pose:slide` and `costa_noche`. **Step 3:** green, commit `fix(pulido): arco a la altura del ojo, deslizar pegado al suelo y el robot se ve de noche`.

### Task 5: balance (its own commit)

- [ ] **Step 1: update tests to the new rule** (intended change): solo PV 1 560, core 390, brote share on `b.max`; the solo simulation prints its phases and must land in 7–9 min (inside the kept 6–10 window); world-sim S5-F tests use the new solo numbers; fish ring time 8.
- [ ] **Step 2:** `FINAL.soloFactor: 1.3`, `finalFactor(1)` uses it; `FISH.ringTime: 8`. **Step 3:** green, commit `balance(pulido): El Marchito solo ×1,3 (≈7,7 min) y 8 s entre anillos del pez`.

### Task 6: Ship

- [ ] Low-tier perf check; HANDOFF "## Pulido · P7-E — …" (arreglado / aplazado / no se arregla, Decidido por Claude — revisar, Qué probar, NO verificado); push; one short comment on PR #3.
