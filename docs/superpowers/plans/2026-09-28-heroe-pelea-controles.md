# Héroe, pelea y controles móviles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the robot with 4 customizable KayKit heroes, fix the attack-spam bug, add a 3-hit combo + spin attack with real clips and hit feel, and cut the phone screen from 14 fixed controls to 6 (with radial wheels).

**Architecture:** Pure logic in small tested modules (`combo.ts`, `wheel.ts`, `act-options.ts`, `hero-look.ts`, `hero-clips.ts`); `game.ts`, `actor.ts` and `touch.ts` wire them. The server keeps its own combo counter (never trusts the client) and gains a `spin` message; protocol 65 → 66. Models are pre-processed once by a committed script into small `.glb` files under `public/models/`.

**Tech Stack:** TypeScript, Three.js 0.185 (GLTFLoader, SkeletonUtils), Vitest, Cloudflare Workers/Durable Objects, Vite.

**Spec:** `docs/superpowers/specs/2026-09-28-heroe-pelea-controles-design.md` (read it first; this plan argues from it).

## Global Constraints

- Player-facing text in **Spanish**, dry and short.
- Every action keeps a key **and** a touch control. Keyboard bindings do not change (E/F act, Space jump, Q roll, Z block, R bow, X lock, H power, J switch, 1 eat, B/V/G/T/Y/U/I build, M mount, C camera, Esc menu).
- Server authoritative: validate range, cooldown, state. `PROTOCOL_VERSION` 65 → **66**. New saved fields **optional** (old saves must load).
- No balance change: punch damage stays `PUNCH.damage × weaponMult`; `PUNCH.cooldown` 0.6 s; `PUNCH.reach` 3.
- Low-tier budget (Visuales spec §3): ≤ 120 draw calls, ≤ 250 k triangles. This plan adds ≤ +2 draw calls (trail + sparks).
- Models: `public/models/heroe-*.glb` total **≤ 1.5 MB**. Credit KayKit (CC0) in `public/models/CREDITS.md`.
- Tests next to source (`foo.ts` → `foo.test.ts`); server tests follow `src/shared/sim/world-sim-p7a.test.ts` (`setup`, `put`, `wolfAt`, `snap` helpers).
- Before **each** commit: `npm test && npm run test:workers && npm run check && npm run build` all green. Never delete/skip/weaken tests to pass; update a test only when the spec changes the behaviour it pins, and say so in the commit.
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Branch: `heroe/pelea-controles` (already created from `main`). Never push to `main`.
- Mark own judgement calls in code/HANDOFF as **"Decidido por Claude — revisar"**.

## File map

| File | Responsibility |
|---|---|
| `scripts/prep-heroe.mjs` (new) | One-off: KayKit `.glb`s → `heroe-anims.glb` + 4 `heroe-<body>.glb` + generated `hero-palette.ts` |
| `public/models/heroe-*.glb` (new) | Hero assets |
| `src/client/actors/hero-palette.ts` (generated) | Atlas cells per body: `cloth`, `skin` |
| `src/client/actors/hero-clips.ts` (new) | `HERO_CLIPS` table, `BODIES`, part visibility rule |
| `src/client/actors/hero-look.ts` (new) | Pure atlas recolour (`recolor(pixels, …)`) + `SKINS` |
| `src/client/actors/actor.ts` | `play(anim, {restart})`, hero parts/hat on `head`, stagger on hit, per-actor texture |
| `src/client/actors/models.ts` | Load hero kits (anims shared) instead of the robot |
| `src/client/actors/poses.ts` | Drop roll/block/bow poses; retarget climb/glide/slide to KayKit bone names |
| `src/shared/protocol.ts` | `ANIMS` + `attack.n?` + `spin` + `look.body?/skin?`; v66 |
| `src/shared/progression.ts` | `Look { body?, skin? }`, `isLook`, `BODY_COUNT`, `SKIN_COUNT` |
| `src/shared/sim/combat.ts` | `SPIN`, `COMBO` constants + pure `nextComboStep` |
| `src/shared/sim/world-sim.ts` | combo counter, 3rd-hit stun/knock, `onSpin`, look body/skin |
| `src/client/combo.ts` (new) | Client combo/buffer/hold state machine |
| `src/client/scene/swing-fx.ts` (new) | Weapon trail + hit sparks (1 mesh + 1 points) |
| `src/client/act-options.ts` (new) | Pure: which context actions apply now (from `act()` order) |
| `src/client/wheel.ts` (new) | Radial wheel DOM component + pure `sectorAt` |
| `src/client/touch.ts` | 6-control layout, floating stick, roll/guard button, wheels, tap-to-lock hook |
| `src/client/hud-model.ts` | `PILLS` → `CONTROLS` (what is shown/dimmed) |
| `src/client/input.ts` | `Keyboard`: report E/F hold time (spin on keyboard) |
| `src/client/look-ui.ts` | Personaje + Piel rows, preview slot |
| `src/client/game.ts` | Wiring everything |
| `src/client/style.css` | New touch layout + wheel styles |
| `docs/superpowers/HANDOFF-aventura.md` | Status section for this plan |

---

### Task 1: Hero assets (prep script, `.glb`s, palette table)

**Files:**
- Create: `scripts/prep-heroe.mjs`, `public/models/heroe-anims.glb`, `public/models/heroe-caballero.glb`, `public/models/heroe-barbaro.glb`, `public/models/heroe-maga.glb`, `public/models/heroe-picaro.glb`, `src/client/actors/hero-palette.ts`, `src/client/actors/hero-assets.test.ts`
- Modify: `public/models/CREDITS.md`

**Interfaces:**
- Produces: files above; `HERO_PALETTE: Record<Body, { cloth: [number, number][]; skin: [number, number][] }>` (cell `[col,row]` in the atlas grid) and `ATLAS_GRID: { cols: number; rows: number }` exported from `hero-palette.ts`; `type Body = 'caballero' | 'barbaro' | 'maga' | 'picaro'` (declared in `hero-palette.ts`, re-exported by `hero-clips.ts`).

Sources (CC0, already downloaded by the planner to the scratchpad; re-download if missing):
`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/{Knight,Barbarian,Mage,Rogue}.glb`

Facts verified by the planner: each file has 1 skin with bones `root, hips, spine, chest, upperarm.l, lowerarm.l, wrist.l, hand.l, handslot.l, upperarm.r, lowerarm.r, wrist.r, hand.r, handslot.r, head, upperleg.l …` (identical across the 4), 76 animations (identical names), one embedded PNG atlas (14–16 KB), ~5.7–7 k triangles. Mesh nodes:
- Knight: `1H_Sword_Offhand, Badge_Shield, Rectangle_Shield, Round_Shield, Spike_Shield, 1H_Sword, 2H_Sword, Knight_Helmet, Knight_Cape, Knight_ArmLeft, Knight_ArmRight, Knight_Body, Knight_Head, Knight_LegLeft, Knight_LegRight`
- Barbarian: `1H_Axe_Offhand, Barbarian_Round_Shield, 1H_Axe, 2H_Axe, Mug, Barbarian_Hat, Barbarian_Cape, Barbarian_ArmLeft, …Body, …Head, …LegLeft, …LegRight`
- Mage: `Spellbook, Spellbook_open, 1H_Wand, 2H_Staff, Mage_Hat, Mage_Cape, Mage_ArmLeft, …`
- Rogue: `Knife_Offhand, 1H_Crossbow, 2H_Crossbow, Knife, Throwable, Rogue_Cape, Rogue_ArmLeft, …`

- [ ] **Step 1: Write the failing asset test**

```ts
// src/client/actors/hero-assets.test.ts
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATLAS_GRID, HERO_PALETTE } from './hero-palette';

const BODIES = ['caballero', 'barbaro', 'maga', 'picaro'] as const;
const CLIPS = [
  'Idle', 'Walking_A', 'Walking_B', 'Running_A', 'Jump_Full_Short', 'Jump_Idle', 'Jump_Land',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Spin',
  'Dodge_Forward', 'Blocking', 'Block_Hit', 'Block_Attack', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Hit_A',
  'Sit_Chair_Idle', 'Cheer', 'Death_A',
];
function gltfJson(path: string) {
  const b = readFileSync(path);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
}

describe('hero assets (KayKit, prep-heroe.mjs)', () => {
  it('one anims file holds every clip the game plays, and nothing else', () => {
    const j = gltfJson('public/models/heroe-anims.glb');
    const names = j.animations.map((a: { name: string }) => a.name).sort();
    expect(names).toEqual([...CLIPS].sort());
  });
  it('each body has its mesh, the shared skeleton and no animations', () => {
    for (const b of BODIES) {
      const j = gltfJson(`public/models/heroe-${b}.glb`);
      expect(j.animations ?? []).toHaveLength(0);
      expect(j.skins).toHaveLength(1);
      const bones = j.skins[0].joints.map((i: number) => j.nodes[i].name);
      for (const n of ['hips', 'head', 'handslot.r', 'handslot.l']) expect(bones).toContain(n);
    }
  });
  it('fits the size budget (≤ 1.5 MB together)', () => {
    const total = ['anims', ...BODIES].reduce((s, n) => s + statSync(`public/models/heroe-${n}.glb`).size, 0);
    expect(total).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });
  it('the palette table names cloth and skin cells inside the grid for every body', () => {
    for (const b of BODIES) {
      const p = HERO_PALETTE[b];
      expect(p.cloth.length).toBeGreaterThan(0);
      expect(p.skin.length).toBeGreaterThan(0);
      for (const [c, r] of [...p.cloth, ...p.skin]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(ATLAS_GRID.cols);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(ATLAS_GRID.rows);
      }
      const skin = new Set(p.skin.map(String));
      expect(p.cloth.some((c) => skin.has(String(c)))).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './hero-palette'`)

Run: `npx vitest run src/client/actors/hero-assets.test.ts`

- [ ] **Step 3: Write `scripts/prep-heroe.mjs`**

Requirements (the script is committed; its deps are **not** added to package.json):
- Header comment: how to run — `npm i --no-save @gltf-transform/core @gltf-transform/functions` then `node scripts/prep-heroe.mjs <dir-with-KayKit-glbs>`; CC0 source URL.
- Uses `NodeIO` from `@gltf-transform/core`, `prune`, `dedup` from `@gltf-transform/functions`.
- Map: `{ Knight: 'caballero', Barbarian: 'barbaro', Mage: 'maga', Rogue: 'picaro' }`.
- **Bodies:** for each source: read, `doc.getRoot().listAnimations().forEach(a => a.dispose())`, `await doc.transform(prune(), dedup())`, write `public/models/heroe-<body>.glb`.
- **Anims:** read `Knight.glb`; dispose every animation whose name is not in the CLIPS list of the test; dispose every `Mesh` (`listMeshes()`), then `prune({ keepLeaves: true })` so the skeleton nodes stay; write `public/models/heroe-anims.glb`.
- **Palette:** for each source, decode the atlas PNG (use `sharp`? no — keep deps minimal: use the `pngjs` package the same way: `npm i --no-save pngjs`) and read every primitive's `TEXCOORD_0` + the node name:
  - grid: detect `cols`/`rows` by testing candidate sizes (4, 8, 16) and choosing the largest where every cell's pixels in a column have the same colour left-to-right within ±6 per channel (the atlas is vertical gradients per cell). Write it to `ATLAS_GRID`.
  - **skin cells**: cells whose mean colour has hue 15°–40°, saturation 0.2–0.6, lightness > 0.6, sampled by UVs of `*_Head`, `*_ArmLeft`, `*_ArmRight` meshes.
  - **cloth cells**: cells sampled by UVs of `*_Body`, `*_Cape`, `*_LegLeft`, `*_LegRight`, `*_ArmLeft`, `*_ArmRight` meshes whose mean colour has saturation > 0.25 and are not skin cells.
  - Emit `src/client/actors/hero-palette.ts`:

```ts
// GENERATED by scripts/prep-heroe.mjs from the KayKit Adventurers atlases (CC0). Do not edit by hand.
export type Body = 'caballero' | 'barbaro' | 'maga' | 'picaro';
export const ATLAS_GRID = { cols: /*n*/, rows: /*n*/ } as const;
/** Atlas cells [col, row] (row 0 = top of the image) that are clothing / skin, per body. */
export const HERO_PALETTE: Record<Body, { cloth: [number, number][]; skin: [number, number][] }> = { /* … */ };
```
- Print each output's size and total.

- [ ] **Step 4: Run the script and eyeball the palette**

```bash
cd C:/Users/gabri/AppData/Local/Temp/claude/C--Users-gabri-Website-IS/b0fdb4b8-3ab3-4517-9288-8a5f1ac44650/scratchpad/kaykit
npm i --no-save @gltf-transform/core @gltf-transform/functions pngjs
node C:/Users/gabri/Website-IS/scripts/prep-heroe.mjs .
```
(The script resolves output paths relative to its own location, `scripts/..`.) Check that the Knight's cloth cells include the blue cells and not the metal greys; if the heuristic misses, adjust thresholds in the script (never hand-edit the generated file).

- [ ] **Step 5: Credits** — append to `public/models/CREDITS.md`:

```md
- `heroe-*.glb`: KayKit Character Pack: Adventurers 1.0 by Kay Lousberg (www.kaylousberg.com), CC0. Trimmed by `scripts/prep-heroe.mjs`.
```

- [ ] **Step 6: Run the test — expect PASS**, then the full gate (`npm test && npm run test:workers && npm run check && npm run build`).

- [ ] **Step 7: Commit**

```bash
git add scripts/prep-heroe.mjs public/models/heroe-*.glb public/models/CREDITS.md src/client/actors/hero-palette.ts src/client/actors/hero-assets.test.ts
git commit -m "feat(heroe): KayKit Adventurers recortados (4 cuerpos + animaciones) y paleta del atlas"
```

---

### Task 2: Hero actor (clips, parts, restart, hat on `head`)

**Files:**
- Create: `src/client/actors/hero-clips.ts`, `src/client/actors/hero-clips.test.ts`
- Modify: `src/client/actors/actor.ts`, `src/client/actors/models.ts`, `src/client/actors/poses.ts`, `src/client/actors/poses.test.ts`, `src/client/game.ts:1089,2356`, `src/client/vitrina.ts:95`

**Interfaces:**
- Consumes: `Body`, `public/models/heroe-*.glb` (Task 1).
- Produces:
  - `hero-clips.ts`: `export { type Body } from './hero-palette'`; `export const BODIES: readonly Body[] = ['caballero','barbaro','maga','picaro']`; `export const HERO_CLIPS: Record<string, ClipDef>`; `export function partVisible(body: Body, mesh: string, hat: number): boolean`.
  - `models.ts`: `loadModels(): Promise<{ heroes: Record<Body, ModelKit>; fox: ModelKit }>` — each hero kit's `clips` are the shared anims file's clips.
  - `Actor.play(anim: string, opts?: { restart?: boolean }): void`
  - `Actor.body: Body` (readonly, set in constructor from a new optional ctor arg `body`).
  - `ClipDef` moves unchanged.

- [ ] **Step 1: Failing tests**

```ts
// src/client/actors/hero-clips.test.ts
import { describe, expect, it } from 'vitest';
import { ANIMS } from '../../shared/protocol';
import { BODIES, HERO_CLIPS, partVisible } from './hero-clips';

describe('hero clips', () => {
  it('every protocol anim and dead has a clip', () => {
    for (const a of [...ANIMS, 'dead', 'seat']) expect(HERO_CLIPS[a], a).toBeDefined();
  });
  it('the combo is three different swings; one-shots are once', () => {
    const c = ['attack1', 'attack2', 'attack3'].map((a) => HERO_CLIPS[a]!.clip);
    expect(new Set(c).size).toBe(3);
    for (const a of ['attack1', 'attack2', 'attack3', 'spin', 'roll', 'cast', 'hurt', 'cheer', 'jump', 'dead']) expect(HERO_CLIPS[a]!.once, a).toBe(true);
    expect(HERO_CLIPS.attack!.clip).toBe(HERO_CLIPS.attack1!.clip); // old clients' 'attack'
  });
});

describe('hero parts', () => {
  it('shows body parts, one 1-hand weapon and (knight/barbarian) one round shield', () => {
    expect(partVisible('caballero', 'Knight_Body', 0)).toBe(true);
    expect(partVisible('caballero', '1H_Sword', 0)).toBe(true);
    expect(partVisible('caballero', 'Round_Shield', 0)).toBe(true);
    for (const m of ['2H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield']) expect(partVisible('caballero', m, 0), m).toBe(false);
    expect(partVisible('barbaro', '1H_Axe', 0)).toBe(true);
    expect(partVisible('barbaro', 'Barbarian_Round_Shield', 0)).toBe(true);
    expect(partVisible('barbaro', 'Mug', 0)).toBe(false);
    expect(partVisible('maga', '1H_Wand', 0)).toBe(true);
    for (const m of ['2H_Staff', 'Spellbook', 'Spellbook_open']) expect(partVisible('maga', m, 0), m).toBe(false);
    expect(partVisible('picaro', 'Knife', 0)).toBe(true);
    for (const m of ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable']) expect(partVisible('picaro', m, 0), m).toBe(false);
  });
  it('a worn hat hides the body\'s own helmet or hat', () => {
    expect(partVisible('caballero', 'Knight_Helmet', 0)).toBe(true);
    expect(partVisible('caballero', 'Knight_Helmet', 3)).toBe(false);
    expect(partVisible('maga', 'Mage_Hat', 2)).toBe(false);
    expect(partVisible('barbaro', 'Barbarian_Hat', 0)).toBe(true);
  });
  it('four bodies', () => expect(BODIES).toEqual(['caballero', 'barbaro', 'maga', 'picaro']));
});
```

Also update `src/client/actors/poses.test.ts`: roll/block/bow no longer have poses (their clips are real now) — replace the first test's list with `for (const a of ['climb','glide','slide']) expect(poseFor(a, 0.1)).not.toBeNull(); for (const a of ['idle','walk','run','attack1','dead','jump','swim','roll','block','bow']) expect(poseFor(a, 0.1)).toBeNull();` and delete the roll/block/bow-specific cases (spec §1.1 retires them — say so in the commit).

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `hero-clips.ts`**

```ts
import type { ClipDef } from './actor';
import type { Body } from './hero-palette';
export type { Body } from './hero-palette';

export const BODIES: readonly Body[] = ['caballero', 'barbaro', 'maga', 'picaro'];

/** Spec §1.1: game anim → KayKit clip. */
export const HERO_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Idle' },
  walk: { clip: 'Walking_A' },
  run: { clip: 'Running_A' },
  jump: { clip: 'Jump_Full_Short', once: true },
  land: { clip: 'Jump_Land', once: true },
  swim: { clip: 'Walking_B', speed: 0.5 },
  attack: { clip: '1H_Melee_Attack_Chop', once: true },
  attack1: { clip: '1H_Melee_Attack_Chop', once: true },
  attack2: { clip: '1H_Melee_Attack_Slice_Horizontal', once: true },
  attack3: { clip: '1H_Melee_Attack_Slice_Diagonal', once: true },
  spin: { clip: '2H_Melee_Attack_Spin', once: true },
  roll: { clip: 'Dodge_Forward', once: true },
  block: { clip: 'Blocking' },
  blockHit: { clip: 'Block_Hit', once: true },
  parry: { clip: 'Block_Attack', once: true },
  bow: { clip: '1H_Ranged_Shoot', once: true },
  cast: { clip: 'Spellcast_Shoot', once: true },
  hurt: { clip: 'Hit_A', once: true },
  climb: { clip: 'Walking_B', speed: 0.5 },
  glide: { clip: 'Jump_Idle' },
  slide: { clip: 'Jump_Idle' },
  seat: { clip: 'Sit_Chair_Idle' },
  cheer: { clip: 'Cheer', once: true },
  dead: { clip: 'Death_A', once: true },
};

const WEAPON: Record<Body, string> = { caballero: '1H_Sword', barbaro: '1H_Axe', maga: '1H_Wand', picaro: 'Knife' };
const SHIELD: Partial<Record<Body, string>> = { caballero: 'Round_Shield', barbaro: 'Barbarian_Round_Shield' };
const OWN_HAT = /_(Helmet|Hat)$/;
const PROPS = /^(1H_|2H_|Badge_|Rectangle_|Round_|Spike_|Barbarian_Round_|Mug|Spellbook|Knife|Throwable)/;

/** Spec §1: body + one 1-hand weapon + (knight/barbarian) a round shield; a worn hat hides the body's own. */
export function partVisible(body: Body, mesh: string, hat: number): boolean {
  if (OWN_HAT.test(mesh)) return hat === 0;
  if (PROPS.test(mesh)) return mesh === WEAPON[body] || mesh === SHIELD[body];
  return true;
}
```

- [ ] **Step 4: `models.ts`** — replace the robot load:

```ts
import { BODIES, type Body } from './hero-clips';
const FILE: Record<Body, string> = { caballero: 'heroe-caballero', barbaro: 'heroe-barbaro', maga: 'heroe-maga', picaro: 'heroe-picaro' };

export async function loadModels(): Promise<{ heroes: Record<Body, ModelKit>; fox: ModelKit }> {
  const [anims, fox, ...bodies] = await Promise.all([
    new GLTFLoader().loadAsync('/models/heroe-anims.glb'),
    load('/models/fox.glb', 0.75, 0),
    ...BODIES.map((b) => load(`/models/${FILE[b]}.glb`, 1.8, 0)),
  ]);
  const heroes = {} as Record<Body, ModelKit>;
  BODIES.forEach((b, i) => (heroes[b] = { ...bodies[i]!, clips: anims.animations }));
  return { heroes, fox };
}
```
KayKit characters face +Z like the robot (verify in the browser in Task 9; set `yawOffset` there if not). Height 1.8 m keeps seats and colliders as they are.

- [ ] **Step 5: `actor.ts`**
  - `play(anim, opts?: { restart?: boolean })`: change the first line to `if (anim === this.currentName && !opts?.restart) return;`. When restarting the same action, call `next.reset()` and skip the crossfade (`if (this.current && this.current !== next) …` already does).
  - Constructor gains an optional 4th arg `body?: Body` stored as `readonly body: Body | null`. After cloning, when `body` is set, traverse meshes and set `o.visible = partVisible(body, o.name, 0)`.
  - `setLook(color, hat)`: keep the signature for now (Task 6 extends it). For hero actors (`this.body !== null`): re-run `partVisible(body, name, hat)` on every mesh when the hat changes; attach hats to the bone named `head` (KayKit) — change `attachHat` to find `o.name === 'head'` first, falling back to the robot rule. Place the hat at `(0, 0.55, 0)` in the head bone's space scaled so the hat is ~0.55 m wide in world units (`hat.scale.setScalar(2.2 * rs.x / s.x)`); tune in Task 9 with the vitrina harness. Colour tint: skip the `'Main'` material path for hero actors (Task 6 replaces it with the atlas recolour).
  - Replace `PLAYER_CLIPS` by re-exporting `HERO_CLIPS` as `PLAYER_CLIPS` from `actor.ts` (`export { HERO_CLIPS as PLAYER_CLIPS } from './hero-clips'`) so `game.ts`/`vitrina.ts` imports keep working. Delete the robot-only constants (`HAT_SIZE`, `HAT_LIFT` if unused).
- [ ] **Step 6: `poses.ts`** — remove `ROLL`, `BLOCK`, `BOW`, `ROLL_S`, `BOW_RELEASE_S`, their `case`s and `'roll' | 'block' | 'bow'` from `PoseAnim`/`POSE_ANIMS`. Rename bone keys in `CLIMB_A`, `CLIMB_B`, `GLIDE`, `SLIDE` from robot names to KayKit's: `UpperArmL→upperarm.l`, `LowerArmL→lowerarm.l`, `UpperArmR→upperarm.r`, `LowerArmR→lowerarm.r`, `UpperLegL→upperleg.l`, `UpperLegR→upperleg.r`, `LowerLegL→lowerleg.l`, `LowerLegR→lowerleg.r`, `Torso→chest`, `Head→head`. Note: GLTFLoader passes node names through `PropertyBinding.sanitizeNodeName`, which strips `.` — so in three.js the bones are named `upperarml`, `handslotr`, `head`… **Verify** by logging bone names once in the browser (or a node test with GLTFLoader) and use exactly those spellings in `poses.ts`, `partVisible` callers, `Actor.hand()` (Task 5) and `attachHat`; `applyPose` builds its map from `o.name`. Add a comment "values solved for the robot; re-tune with the vitrina in Task 9 — Decidido por Claude — revisar". Update the file header comment.
- [ ] **Step 7: `game.ts` / `vitrina.ts`** — `this.kits.robot` → `this.kits.heroes[BODIES[look.body ?? 0]]` for self (`game.ts:2356`) and remote players (`game.ts:1089`, using the remote player's `p.look?.body ?? 0` — `body` arrives in Task 6; until then use `'caballero'`), passing the body as the Actor's 4th arg; `vitrina.ts:95` uses `kits.heroes.caballero`. Where `'attack'` was set by `attackUntil`, keep it for now (Task 4 replaces it).
- [ ] **Step 8: Run tests — expect PASS; full gate; commit**

```bash
git commit -am "feat(heroe): el héroe KayKit reemplaza al robot (clips reales, piezas, sombrero en head)"
```
(`git add` the two new files first.)

---

### Task 3: Server — combo counter, 3rd-hit stagger, spin, look body/skin, protocol 66

**Files:**
- Modify: `src/shared/protocol.ts`, `src/shared/progression.ts`, `src/shared/sim/combat.ts`, `src/shared/sim/world-sim.ts`, `src/shared/protocol.test.ts`, `src/shared/sim/world-sim-p7a.test.ts:43-44` (protocol number)
- Create: `src/shared/sim/world-sim-h1.test.ts`

**Interfaces:**
- Produces:
  - `ANIMS` = previous list + `'attack1','attack2','attack3','spin','cast','hurt','cheer','seat','land'`.
  - `ClientMsg`: `{ t: 'attack'; id: number; n?: 1 | 2 | 3 }`, `{ t: 'spin' }`, `{ t: 'look'; color: number; hat: number; body?: number; skin?: number }`.
  - `progression.ts`: `interface Look { color: number; hat: number; body?: number; skin?: number }`, `BODY_COUNT = 4`, `SKIN_COUNT = 5`, `isLook(color, hat, body?, skin?)` (body/skin optional; when present must be integers in range).
  - `combat.ts`: `export const COMBO = { window: 0.5, knock: 1.5, stun: 0.4 } as const; export const SPIN = { reach: 3, cooldown: 4 } as const; export function nextComboStep(step: number, lastAt: number, now: number, cooldown: number): 1 | 2 | 3`.
  - `PROTOCOL_VERSION = 66`.

- [ ] **Step 1: Failing tests** — `src/shared/sim/world-sim-h1.test.ts` (copy the helper block from `world-sim-p7a.test.ts` lines 1–38, same imports plus `COMBO, SPIN, nextComboStep` from `./combat`):

```ts
describe('combo (server)', () => {
  it('nextComboStep: 1→2→3→1, and back to 1 after the window', () => {
    expect(nextComboStep(0, 0, 10, 0.6)).toBe(1);
    expect(nextComboStep(1, 10, 10.7, 0.6)).toBe(2);
    expect(nextComboStep(2, 10.7, 11.4, 0.6)).toBe(3);
    expect(nextComboStep(3, 11.4, 12.1, 0.6)).toBe(1);
    expect(nextComboStep(1, 10, 10 + 0.6 + COMBO.window + 0.01, 0.6)).toBe(1);
  });

  it('the third blow in a row stuns a wolf and pushes it back; damage is unchanged', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    const a = sim.getPlayer('Ana')!;
    w.hp = 999;
    const hits: number[] = [];
    let stunAfter = 0;
    for (let i = 0; i < 3; i++) {
      const before = w.hp;
      sim.handle('Ana', { t: 'attack', id: w.id });
      hits.push(before - w.hp);
      if (i < 2) expect(w.stun).toBe(0);
      stunAfter = w.stun;
      sim.time += 0.7;
    }
    expect(new Set(hits).size).toBe(1);
    expect(stunAfter).toBe(COMBO.stun);
    expect(Math.hypot(w.x - a.x, w.z - a.z)).toBeGreaterThan(1 + COMBO.knock - 0.01);
  });

  it('the client step is ignored: n=3 on a first blow does not stun', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    w.hp = 999;
    sim.handle('Ana', { t: 'attack', id: w.id, n: 3 });
    expect(w.stun).toBe(0);
  });
});

describe('spin (server)', () => {
  it('hits every enemy within 3 m once, then waits 4 s', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    w.hp = 999;
    const far = sim.wolfList[1];
    sim.handle('Ana', { t: 'spin' });
    const once = 999 - w.hp;
    expect(once).toBeGreaterThan(0);
    sim.time += 1;
    sim.handle('Ana', { t: 'spin' });
    expect(999 - w.hp).toBe(once);
    sim.time += SPIN.cooldown;
    sim.handle('Ana', { t: 'spin' });
    expect(999 - w.hp).toBe(once * 2);
    if (far) expect(far.hp).toBeGreaterThan(0);
  });
  it('is refused while dead or riding', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    w.hp = 999;
    sim.getPlayer('Ana')!.dead = true;
    sim.handle('Ana', { t: 'spin' });
    expect(w.hp).toBe(999);
  });
  it('resets the combo', () => {
    const sim = setup('Ana');
    const w = wolfAt(sim, 1);
    w.hp = 999;
    sim.handle('Ana', { t: 'attack', id: w.id });
    sim.time += 0.7;
    sim.handle('Ana', { t: 'attack', id: w.id });
    sim.time += 0.7;
    sim.handle('Ana', { t: 'spin' });
    sim.time += 0.7;
    sim.handle('Ana', { t: 'attack', id: w.id }); // step 1 again: no stun
    expect(w.stun).toBe(0);
  });
});

describe('look body/skin', () => {
  it('saves body and skin; old looks stay valid', () => {
    const sim = setup('Ana');
    sim.handle('Ana', { t: 'look', color: 2, hat: 0, body: 3, skin: 4 });
    expect(sim.getPlayer('Ana')!.look).toEqual({ color: 2, hat: 0, body: 3, skin: 4 });
    sim.handle('Ana', { t: 'look', color: 1, hat: 0 });
    expect(sim.getPlayer('Ana')!.look).toEqual({ color: 1, hat: 0 });
  });
  it('others see a non-default body', () => {
    const sim = setup('Ana', 'Bea');
    sim.handle('Ana', { t: 'look', color: 0, hat: 0, body: 2 });
    const me = snap(sim, 'Bea').players.find((p) => p.name === 'Ana')!;
    expect(me.look).toEqual({ color: 0, hat: 0, body: 2 });
  });
});
```
Fix the stun expectation while writing it: record `w.stun` right after the 3rd `handle` (before `sim.time += 0.7`) and assert `toBe(COMBO.stun)`. In `protocol.test.ts` add decode cases: `{"t":"attack","id":5,"n":2}` → `{t:'attack',id:5,n:2}`; `n: 4` and `n: 1.5` → `null`; `{"t":"spin"}` → `{t:'spin'}`; look with `body:3,skin:4` accepted; `body:4` / `skin:5` / `body:-1` → `null`; look without them still accepted; and `PROTOCOL_VERSION` is 66. Update `world-sim-p7a.test.ts`'s `'protocol 65'` test to 66 (spec change).

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**
  - `combat.ts`: add `COMBO`, `SPIN`, and

```ts
/** Spec §2.2: the next swing's step — 1–3, back to 1 after the window that opens when the cooldown ends. */
export function nextComboStep(step: number, lastAt: number, now: number, cooldown: number): 1 | 2 | 3 {
  if (step <= 0 || step >= 3 || now - lastAt > cooldown + COMBO.window) return 1;
  return (step + 1) as 2 | 3;
}
```
  - `protocol.ts`: `PROTOCOL_VERSION = 66`; extend `ANIMS`; `decodeClient` `'attack'`: `id(m.id) && (m.n === undefined || m.n === 1 || m.n === 2 || m.n === 3) ? { t: 'attack', id: m.id, ...(m.n ? { n: m.n } : {}) } : null`; new `case 'spin': return { t: 'spin' };`; `'look'`: `isLook(m.color, m.hat, m.body, m.skin) ? { t:'look', color, hat, ...(m.body !== undefined ? { body } : {}), ...(m.skin !== undefined ? { skin } : {}) } : null`. Add both to the `ClientMsg` union.
  - `progression.ts`: extend `Look`, add `BODY_COUNT`, `SKIN_COUNT`, `isLook(color, hat, body?, skin?)` = old check `&& (body === undefined || isIndex(body, BODY_COUNT - 1)) && (skin === undefined || isIndex(skin, SKIN_COUNT - 1))`.
  - `world-sim.ts`:
    - `Live` gains `comboStep: number; comboAt: number; spinReadyAt: number` (initialise to `0, -99, 0` where `Live` objects are created — search `punchReadyAt:`).
    - `onAttack` (ground branch only, after the reach/rayo/anchor checks): `const step = nextComboStep(l.comboStep, l.comboAt, this.time, PUNCH.cooldown); l.comboStep = step; l.comboAt = this.time; l.anim = `attack${step}` as Anim;` then `this.strike(...)`; then if `step === 3` call a new `private stagger(p, w)` that, only for ordinary enemies (`w.kind === 'wolf' || w.kind === 'brute'` and `w.hp > 0` and `w.tut === undefined`), sets `w.stun = Math.max(w.stun, COMBO.stun)` and moves it `COMBO.knock` m away from the player along the player→enemy direction (keep `y` on the terrain: `w.y = this.terrain.heightAt(w.x, w.z)`). The dragon branch keeps `l.anim = 'attack'`.
    - `onSpin(p, l)`: return if `p.dead || l.riding || l.fish || l.frog || l.dragon || l.seat || this.time + EPS < l.spinReadyAt`; set `l.spinReadyAt = this.time + SPIN.cooldown`, `l.punchReadyAt = this.time + PUNCH.cooldown`, `l.comboStep = 0`, `l.anim = 'spin'`; for each enemy from the same list `onAttack` resolves ids from (`this.enemy(id)` — iterate `this.wolfList` plus bosses/elites the way `enemiesNear`/FX code does; find the existing helper that lists hittable enemies near a point, e.g. search `hittable` / `wolvesNear`) within `SPIN.reach` in XZ and alive: `this.strike(p.name, w, PUNCH.damage * weaponMult(p.weaponLvl ?? 0))`. Route `case 'spin': return this.onSpin(p, l);` in `handle`.
    - `onLook(p, color, hat, body?, skin?)`: `p.look = { color, hat, ...(body !== undefined ? { body } : {}), ...(skin !== undefined ? { skin } : {}) }`; `lookField` sends the look when any of `color, hat, body, skin` is non-zero. `lookOf` must accept the optional fields (validate with the new `isLook`).
- [ ] **Step 4: Run — PASS; full gate (the workers tests assert the protocol version too — update `test/workers` expectations if they pin 65); commit**

```bash
git commit -am "feat(pelea): combo de 3 en el servidor (el 3.º aturde y empuja), ataque giratorio y personaje/piel en look; protocolo 66"
```

---

### Task 4: Client combo — bug fix, buffered blow, hold-to-spin, anims

**Files:**
- Create: `src/client/combo.ts`, `src/client/combo.test.ts`
- Modify: `src/client/game.ts` (`act()` ~1886–1932, anim picker ~2327–2333, `onClick`, `power()` ~2172, `onImpact` hurt, remote `r.actor.play` ~2674), `src/client/input.ts` (Keyboard hold for E/F)

**Interfaces:**
- Consumes: `nextComboStep`, `COMBO`, `SPIN` (`src/shared/sim/combat.ts`), `PUNCH` (already imported in game.ts), `HERO_CLIPS` durations via the loaded clips.
- Produces:

```ts
export type Swing = { kind: 'swing'; step: 1 | 2 | 3 } | { kind: 'spin' };
export class Combo {
  constructor(cooldownS: number, spinHoldS: number, spinCooldownS: number);
  /** Button went down at `now` (s). */
  press(now: number): void;
  /** Button went up at `now`: returns a swing to do now, or null (buffered / nothing). */
  release(now: number): Swing | null;
  /** Called every frame: a buffered swing whose cooldown has ended, or null. */
  tick(now: number): Swing | null;
  /** 0–1 while holding toward a spin (for the glow); 0 when not holding. */
  charge(now: number): number;
  /** Server-side reset mirrors: after a spin, the next swing is step 1. */
  readonly step: number;
}
```

- [ ] **Step 1: Failing tests**

```ts
// src/client/combo.test.ts
import { describe, expect, it } from 'vitest';
import { Combo } from './combo';

const tap = (c: Combo, t: number) => {
  c.press(t);
  return c.release(t + 0.05);
};

describe('Combo (spec §2.1)', () => {
  it('taps chain 1→2→3→1 when spaced by the cooldown', () => {
    const c = new Combo(0.6, 0.8, 4);
    expect(tap(c, 0)).toEqual({ kind: 'swing', step: 1 });
    expect(tap(c, 0.7)).toEqual({ kind: 'swing', step: 2 });
    expect(tap(c, 1.4)).toEqual({ kind: 'swing', step: 3 });
    expect(tap(c, 2.1)).toEqual({ kind: 'swing', step: 1 });
  });
  it('a late tap restarts at 1', () => {
    const c = new Combo(0.6, 0.8, 4);
    tap(c, 0);
    expect(tap(c, 0.6 + 0.5 + 0.1)).toEqual({ kind: 'swing', step: 1 });
  });
  it('an early tap is buffered (only one) and comes out when the cooldown ends', () => {
    const c = new Combo(0.6, 0.8, 4);
    tap(c, 0);
    expect(tap(c, 0.2)).toBeNull();
    expect(tap(c, 0.3)).toBeNull(); // still one buffered
    expect(c.tick(0.5)).toBeNull();
    expect(c.tick(0.6)).toEqual({ kind: 'swing', step: 2 });
    expect(c.tick(0.7)).toBeNull();
  });
  it('holding 0.8 s and releasing spins; releasing sooner is a swing', () => {
    const c = new Combo(0.6, 0.8, 4);
    c.press(0);
    expect(c.charge(0.4)).toBeCloseTo(0.5);
    expect(c.release(0.85)).toEqual({ kind: 'spin' });
    c.press(1);
    expect(c.release(1.5)).toEqual({ kind: 'swing', step: 1 }); // spin reset the combo
  });
  it('spin waits its own cooldown; a held release during it is a plain swing', () => {
    const c = new Combo(0.6, 0.8, 4);
    c.press(0);
    c.release(0.9);
    c.press(1.6);
    expect(c.release(2.5)).toEqual({ kind: 'swing', step: 1 });
    c.press(5);
    expect(c.release(5.9)).toEqual({ kind: 'spin' });
  });
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `combo.ts`** (use `nextComboStep` from `../shared/sim/combat` so client and server agree):

```ts
import { nextComboStep } from '../shared/sim/combat';

export type Swing = { kind: 'swing'; step: 1 | 2 | 3 } | { kind: 'spin' };

/** Spec §2.1: tap = combo swing (one buffered if early), hold ≥ spinHold and release = spin. Times in seconds. */
export class Combo {
  step = 0;
  private lastAt = -99;
  private readyAt = 0;
  private spinReadyAt = 0;
  private buffered = false;
  private downAt: number | null = null;

  constructor(private readonly cooldown: number, private readonly spinHold: number, private readonly spinCooldown: number) {}

  press(now: number): void {
    this.downAt = now;
  }

  release(now: number): Swing | null {
    const held = this.downAt === null ? 0 : now - this.downAt;
    this.downAt = null;
    if (held >= this.spinHold && now >= this.spinReadyAt) {
      this.spinReadyAt = now + this.spinCooldown;
      this.readyAt = now + this.cooldown;
      this.step = 0;
      this.buffered = false;
      return { kind: 'spin' };
    }
    if (now < this.readyAt) {
      this.buffered = true;
      return null;
    }
    return this.swing(now);
  }

  tick(now: number): Swing | null {
    if (!this.buffered || now < this.readyAt) return null;
    this.buffered = false;
    return this.swing(now);
  }

  charge(now: number): number {
    if (this.downAt === null || now < this.spinReadyAt) return 0;
    return Math.min(1, (now - this.downAt) / this.spinHold);
  }

  private swing(now: number): Swing {
    const step = nextComboStep(this.step, this.lastAt, now, this.cooldown);
    this.step = step;
    this.lastAt = now;
    this.readyAt = now + this.cooldown;
    return { kind: 'swing', step };
  }
}
```

- [ ] **Step 4: Wire into `game.ts`**
  - Field `private readonly combo = new Combo(PUNCH.cooldown, 0.8, SPIN.cooldown);` and `private swingAnim: { anim: Anim; until: number } | null = null`.
  - Split `act()`: everything before `this.attackUntil = performance.now() + 450;` (the context actions) stays in `act()`; the melee part moves to `private strikeNow(s: Swing)`:
    - `swing`: pick target as today (locked in reach, else nearest in `PUNCH.reach`); **face** the target in both cases (`this.face(t)`); send `{ t: 'attack', id, n: s.step }` if a target exists; set `this.swingAnim = { anim: `attack${s.step}`, until: now + clipMs }` where `clipMs` = the clip's duration × 1000 from `this.kits.heroes.caballero.clips.find(c => c.name === HERO_CLIPS['attack' + step].clip)?.duration ?? 0.6`; call `this.me?.play(anim, { restart: true })` immediately; audio `golpe-aire` stays in `sendCue`.
    - `spin`: send `{ t: 'spin' }`, `swingAnim = { anim: 'spin', until: now + spinClipMs }`, restart play.
  - Attack input: **press** on E/F keydown, mouse down, touch Attack pointerdown → `this.onAttackDown()`; **release** on keyup / mouseup / pointerup → `this.onAttackUp()`:
    - `onAttackDown`: run the context part of `act()` first; if a context action fired, mark `this.attackDownUsed = true` and return (no combo). Else `this.combo.press(now/1000)`.
    - `onAttackUp`: if `attackDownUsed` reset it and return; else `const s = this.combo.release(now/1000); if (s) this.strikeNow(s)`.
    - Every frame in `stepCombat`: `const s = this.combo.tick(now/1000); if (s) this.strikeNow(s);` and glow the weapon with `this.combo.charge(...)` via `this.me?.setCharge(k)` (add to Actor: scales an additive glow sprite at `handslot.r`; hidden at 0).
    - The dragon's claw path stays a plain tap (no combo) — keep it in `act()` as today, setting `swingAnim = { anim: 'attack1', until: now + 450 }`.
  - `input.ts` `Keyboard`: add optional callbacks `onDown(code)`/`onUp(code)` for `KeyE`/`KeyF` (ignoring `e.repeat`) and stop routing them through `onAction('act')`; mouse: `pointerdown`/`pointerup` on the canvas instead of `click` (keep pointer-lock behaviour of `onClick`).
  - Anim picker: replace `if (now < this.attackUntil) anim = 'attack';` with `if (this.swingAnim && now < this.swingAnim.until) anim = this.swingAnim.anim;`; add `if (now < this.castUntil) anim = 'cast'` (set `castUntil = now + 600` in `power()` when a cast is sent) and `if (now < this.hurtUntil && !blocking && !rolling) anim = 'hurt'` (set `hurtUntil = now + 400` where `hurtReaction` fires in `onImpact`); riding/seat → `'seat'` instead of `'idle'`; delete `attackUntil`.
  - Remote players (`game.ts` ~2674): `r.actor.play(r.anim, { restart: r.anim !== r.lastAnim && /^attack|spin/.test(r.anim) })` isn't enough when the step repeats; since the server alternates `attack1/2/3`, a new step always changes the name — plain `play` works. `'attack'` from old snapshots maps to `attack1` through `HERO_CLIPS.attack`.
  - `cheer`: play once on Rango up (where `this.me.flash(` is called for the rank-up glow) by setting `swingAnim = { anim: 'cheer', until: now + 1500 }`.
- [ ] **Step 5: Run tests + gate. Manually (dev server, Task 9 does the full pass):** hammering E shows 1-2-3 swings, never frozen. **Commit**

```bash
git commit -am "fix(pelea): cada golpe se ve (combo 1-2-3, golpe guardado, giratorio al mantener); poderes y daño con animación"
```

---

### Task 5: Hit feel — weapon trail, sparks, stagger

**Files:**
- Create: `src/client/scene/swing-fx.ts`, `src/client/scene/swing-fx.test.ts`
- Modify: `src/client/actors/actor.ts` (`impact` knock on hits, `handslot` accessor), `src/client/game.ts` (`onImpact`, frame update)

**Interfaces:**
- Produces:
  - `export function trailAlpha(age: number, life: number): number` (1 → 0 linear, 0 when `age ≥ life`).
  - `export class SwingFx { constructor(scene: THREE.Scene); startTrail(from: THREE.Object3D, color: number, seconds: number): void; sparks(at: THREE.Vector3, ring?: boolean): void; update(dt: number): void }` — one `Mesh` (12-segment ribbon, `BufferGeometry` updated in place, `MeshBasicMaterial` additive, `depthWrite:false`, `fog:false`) and one `Points` (64 max, pooled).
  - `Actor.hand(): THREE.Object3D | null` — the `handslot.r` bone.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { trailAlpha } from './swing-fx';
describe('swing trail', () => {
  it('fades linearly and ends at life', () => {
    expect(trailAlpha(0, 0.2)).toBe(1);
    expect(trailAlpha(0.1, 0.2)).toBeCloseTo(0.5);
    expect(trailAlpha(0.2, 0.2)).toBe(0);
    expect(trailAlpha(1, 0.2)).toBe(0);
  });
});
```
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement `swing-fx.ts`**: ribbon keeps the last 12 world positions of `from` (tip = `from` world position + 0.6 m along its local +Y, base = `from` position) sampled each `update` while the trail is live, vertex colour alpha by `trailAlpha(age of that sample, 0.2)`; sparks: 10 points with random velocity 2–4 m/s, gravity 9.8, life 0.3 s; `ring` = 16 points on a horizontal circle expanding 0→1.2 m. Colours: white for steps 1–2, gold `0xffd24a` for step 3 and spin, blue-white `0xbfe6ff` for parry ring.
- [ ] **Step 4: Wire**: `strikeNow` calls `this.swingFx.startTrail(this.me.hand(), color, clipSeconds)`; `onImpact` on an own `hit`/`kill` calls `sparks(enemy position + y 0.8)`, on `parry` `sparks(me + y 1, true)`; `Actor.impact` gets knockback on every hit, not only kills: in `impactStep` allow `this.knock` while `currentName !== 'dead'` for `t < 0.15` with distance `IMPACT.stagger` (add `stagger: 0.3` to `IMPACT` in `impact.ts`, pass `knock` from `reactTo` for own hits on Actor enemies — paper enemies already squash). Add a lean: `this.model.rotation.x = -0.25 * (1 - k)` during the stagger, restored after.
- [ ] **Step 5: Gate; perf check** `npm run perf -- --tier low` (Chromium headless) still inside budget; note numbers in the commit body. **Commit**

```bash
git commit -am "feat(pelea): estela del arma, chispas y tambaleo del enemigo al golpear"
```

---

### Task 6: Appearance — body, outfit colour, skin, Aspecto panel

**Files:**
- Create: `src/client/actors/hero-look.ts`, `src/client/actors/hero-look.test.ts`
- Modify: `src/client/actors/actor.ts` (`setLook`), `src/client/look-ui.ts`, `src/client/look-ui.test.ts`, `src/client/game.ts` (`showLook` ~2109, remote look ~1102, self ~2365), `src/shared/names.ts` (body names)

**Interfaces:**
- Consumes: `HERO_PALETTE`, `ATLAS_GRID` (Task 1), `COLORS`, `Look` (Task 3).
- Produces:
  - `export const SKINS: readonly number[]` — 5 tones: `[-1 (original), 0xf1c9a5, 0xd9a07a, 0xa86b45, 0x6e4128]` (−1 = keep).
  - `export function recolor(px: Uint8ClampedArray, w: number, h: number, cells: readonly [number, number][], grid: { cols: number; rows: number }, target: number): void` — in place; for each pixel in the listed cells, keep its **lightness relative to the cell's mean** and set hue/saturation from `target` (so the gradient survives): `out = target_rgb * (pixelLum / cellMeanLum)` clamped.
  - `export function heroTextureKey(body: number, color: number, skin: number): string`.
  - `Actor.setLook(look: Look)` (object instead of two numbers; update the two existing call sites).
  - `lookHtml(look, unlocked)` gains rows `Personaje` (4 buttons `data-a="body-<i>"`, names from `NAMES.bodyNames`) and `Piel` (5 swatches `data-a="skin-<i>"`) and a `<div class="look-preview"></div>` slot.

- [ ] **Step 1: Failing tests**

```ts
// src/client/actors/hero-look.test.ts
import { describe, expect, it } from 'vitest';
import { recolor, SKINS } from './hero-look';

const grid = { cols: 2, rows: 1 };
function img() {
  // 2 cells side by side, 2×2 px each: cell 0 dark→light blue, cell 1 grey
  const px = new Uint8ClampedArray(4 * 2 * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => px.set([r, g, b, 255], (y * 4 + x) * 4);
  set(0, 0, 40, 60, 160); set(1, 0, 40, 60, 160); set(0, 1, 80, 120, 220); set(1, 1, 80, 120, 220);
  for (const [x, y] of [[2, 0], [3, 0], [2, 1], [3, 1]]) set(x!, y!, 128, 128, 128);
  return px;
}

describe('recolor (spec §3)', () => {
  it('repaints only the listed cells, keeping the gradient', () => {
    const px = img();
    recolor(px, 4, 2, [[0, 0]], grid, 0xc84040);
    const top = [...px.slice(0, 3)];
    const bottom = [...px.slice(16, 19)];
    expect(top[0]!).toBeGreaterThan(top[2]!); // now red-ish
    expect(bottom[0]!).toBeGreaterThan(top[0]!); // still lighter at the bottom
    expect([...px.slice(8, 11)]).toEqual([128, 128, 128]); // cell 1 untouched
  });
  it('five skins, the first keeps the original', () => {
    expect(SKINS).toHaveLength(5);
    expect(SKINS[0]).toBe(-1);
  });
});
```
In `look-ui.test.ts` add: the HTML has 4 `data-a="body-` buttons with the chosen one `on`, 5 `data-a="skin-` buttons, and a `look-preview` div.

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** `hero-look.ts` (pure), then in `actor.ts` `setLook(look)`: key `${body}:${color}:${skin}:${hat}`; for hero actors build (cached in a static `Map<string, THREE.Texture>` by `heroTextureKey`) a `CanvasTexture` from the body's original atlas image downscaled to 128² (`drawImage` into a 128×128 canvas, `getImageData`, `recolor` cloth cells to `COLORS[color]` when `color > 0`, skin cells to `SKINS[skin]` when `skin > 0`, `putImageData`), `flipY = false`, `colorSpace = SRGBColorSpace`; clone the body material once per actor, set `.map`, run `patchRim`. **Body change** can't be done in place (different mesh): `game.ts` recreates the actor when `look.body` differs from `actor.body` (dispose old, `new Actor(kits.heroes[BODIES[body]], PLAYER_CLIPS, label, BODIES[body])`) — both for `this.me` and remote players.
  - `names.ts`: `bodyNames: ['Caballero', 'Bárbaro', 'Maga', 'Pícaro']` and `skinNames: ['Original', 'Clara', 'Media', 'Morena', 'Oscura']` (a test forbids hard-coded proper names elsewhere — follow it).
  - `game.showLook()`: handle `body-<i>` and `skin-<i>` like `color-<i>`, sending `{ t: 'look', color, hat, body, skin }`; the preview: while the panel is open, render the player's actor into a 160×220 `WebGLRenderer`-less approach — reuse the main renderer with `renderer.setScissor/Viewport` on a corner rect over the `.look-preview` element's bounding box each frame, camera at 2.2 m in front at chest height, the preview actor rotating 0.6 rad/s. Stop when the panel closes. **Decidido por Claude — revisar.**
- [ ] **Step 4: Gate; commit**

```bash
git commit -am "feat(aspecto): elige personaje (4), color de ropa y piel; vista que gira en el panel"
```

---

### Task 7: Context options + radial wheel (pure + DOM)

**Files:**
- Create: `src/client/act-options.ts`, `src/client/act-options.test.ts`, `src/client/wheel.ts`, `src/client/wheel.test.ts`
- Modify: `src/client/game.ts` (`act()` uses `actOptions`), `src/client/style.css`

**Interfaces:**
- Produces:
  - `act-options.ts`:

```ts
export type ActOption =
  | { k: 'revive'; name: string } | { k: 'shrine'; id: number; part: number } | { k: 'dungeon'; act: number }
  | { k: 'chest'; id: number } | { k: 'amber'; id: number } | { k: 'quartz'; id: number } | { k: 'fogata'; id: number }
  | { k: 'travel' } | { k: 'rescue' } | { k: 'pillar'; id: number } | { k: 'guardian' } | { k: 'mount'; act: number }
  | { k: 'tend' } | { k: 'upgrade' } | { k: 'capa' } | { k: 'stall' };
export interface ActProbe { /* one nullable field per option, filled by game.ts from its existing helpers */ }
/** Spec §4: the context actions that apply now, in act()'s priority order (combat is handled separately). */
export function actOptions(p: ActProbe): ActOption[];
export const OPTION_LABEL: Record<ActOption['k'], { icon: string; text: string }>;
```
  `ActProbe` fields mirror the calls in `act()` today (`fallen`, `shrinePart`, `dungeon`, `coast`, `swamp`, `quartz`, `fogata`, `rescue`, `pillar`, `guardian`, `mount`, `tend`, `stall`), each the value its helper already returns. Labels in Spanish: Levantar, Tocar, Abrir, Cofre, Ámbar, Cuarzo, Encender, Viajar, Rescatar, Pilar, Hablar, Montar, Cuidar, Mejorar arma, Capa, Puesto.
  - `wheel.ts`: `export function sectorAt(dx: number, dy: number, n: number, dead = 28): number | null` (null inside the dead zone; sector 0 centred at 12 o'clock, clockwise); `export class Wheel { constructor(parent: HTMLElement); open(x: number, y: number, items: { icon: string; text: string }[], pick: (i: number | null) => void): void; move(x: number, y: number): void; release(x: number, y: number): void; tap(i: number): void; close(): void; readonly isOpen: boolean }` — up to 6 items, 200 px circle, highlighted sector, release outside radius 110 px → `pick(null)`; items also tappable.

- [ ] **Step 1: Failing tests**

```ts
// src/client/wheel.test.ts
import { describe, expect, it } from 'vitest';
import { sectorAt } from './wheel';
describe('sectorAt', () => {
  it('dead zone is null; 12 o\'clock is 0; clockwise', () => {
    expect(sectorAt(0, 0, 4)).toBeNull();
    expect(sectorAt(0, -60, 4)).toBe(0);
    expect(sectorAt(60, 0, 4)).toBe(1);
    expect(sectorAt(0, 60, 4)).toBe(2);
    expect(sectorAt(-60, 0, 4)).toBe(3);
    expect(sectorAt(10, -60, 6)).toBe(0);
    expect(sectorAt(-10, -60, 6)).toBe(0);
  });
});
```
```ts
// src/client/act-options.test.ts
import { describe, expect, it } from 'vitest';
import { actOptions, type ActProbe } from './act-options';
const none: ActProbe = { fallen: null, shrinePart: null, dungeon: null, coast: null, swamp: null, quartz: null, fogata: null, rescue: false, pillar: null, guardian: false, mount: null, tend: false, upgrade: false, capa: false, stall: false };
describe('actOptions', () => {
  it('none → empty', () => expect(actOptions(none)).toEqual([]));
  it('one → one', () => expect(actOptions({ ...none, coast: { t: 'chest', id: 4 } })).toEqual([{ k: 'chest', id: 4 }]));
  it('several keep act() priority order', () => {
    const o = actOptions({ ...none, mount: { act: 3 }, coast: { t: 'chest', id: 4 }, fogata: { t: 'fogata', id: 1 } });
    expect(o.map((x) => x.k)).toEqual(['chest', 'fogata', 'mount']);
  });
  it('a fogata hint is not an option (it only toasts)', () => {
    expect(actOptions({ ...none, fogata: { t: 'hint', label: 'x' } })).toEqual([]);
  });
});
```
Define `ActProbe` exactly with the field types those helpers return in `game.ts` today (read `coastAct`, `swampAct`, `fogataAct`, `mountAct`, `shrinePart`, `pillarAct`, `dungeonAction` return types and import them as types; the test uses the minimal literal shapes — adjust the test's literals to match the real types while keeping the three behaviours).

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement both; refactor `act()`** to: build the probe, `const opts = actOptions(probe)`; if an enemy is within `PUNCH.reach` → combat (Task 4 path) wins as today (except `revive`, `shrine`, `dungeon`, which today run **before** combat: keep that order — the pure function returns them first and `act()` runs them first); else `opts.length === 1` → `this.runOption(opts[0])` (the existing `conn.send` per kind, moved into one `switch`); `opts.length ≥ 2` → `this.wheel.open(center of Attack button or screen centre, opts.map(o => OPTION_LABEL[o.k]), i => i !== null && this.runOption(opts[i]))`. On keyboard, the wheel opens at screen centre and digits 1–6 pick. Behaviour with 0/1 options is unchanged.
- [ ] **Step 4: CSS** `.wheel` (circle, sectors as absolutely positioned items at 80 px radius, `.on` highlight, text ≥ 16 px scaled by the text-size setting). **Gate; commit**

```bash
git commit -am "feat(controles): rueda radial y elección cuando A tiene varias opciones"
```

---

### Task 8: Phone layout — 6 controls

**Files:**
- Modify: `src/client/touch.ts`, `src/client/hud-model.ts`, `src/client/hud-model.test.ts`, `src/client/tutorial-ui.ts`, `src/client/tutorial-ui.test.ts`, `src/client/guide-ui.ts` (pill indices), `src/client/game.ts` (touch handlers, tap-to-lock), `src/client/style.css`

**Interfaces:**
- Consumes: `Wheel` (Task 7), attack down/up (Task 4).
- Produces:
  - `hud-model.ts`: `export const CONTROLS = ['attack', 'jump', 'roll', 'power', 'bag'] as const;` `export function controlsDim(s: { power: boolean; bow: boolean; tools: boolean }): boolean[]` (dimmed, never hidden: power dims when no power and no bow; bag never dims). `PILLS`/`pillsShown` remain for the **bag wheel's** items (`eat, campfire, wall, heart, trap`) and for keyboard hints; `pillsShown` output decides which bag-wheel items exist.
  - `TouchHandlers` gains `onAttackDown()`, `onAttackUp()`, `onRollDown()`, `onRollUp()`, `onPowerWheel(): { icon: string; text: string; code: string }[]`, `onBagWheel(): { icon: string; text: string; code: string }[]`, `onTapWorld(x: number, y: number): boolean` (true = consumed, e.g. an enemy was locked).
  - `TouchControls.setHint(controls: readonly boolean[], stick: boolean)` (replaces the pill-index version), `setActIcon(icon: string | null)`, `setDim(dim: readonly boolean[])`, `setPowerIcon` unchanged.

Layout (spec §4): right thumb arc — Atacar (80 px, bottom-right), Saltar (56 px, left of it), Rodar (56 px, above-left), Poder (56 px, above); 🎒 (48 px) and MENÚ top-right; stick floats (appears at the first touch point in the left half, radius 52 px, fades when released). All positions respect `env(safe-area-inset-*)`.

- [ ] **Step 1: Failing tests** — `hud-model.test.ts`: `controlsDim({ power: false, bow: false, tools: true })` → `[false, false, false, true, false]`; `{ power: false, bow: true, … }` → power not dimmed. `tutorial-ui.test.ts`: every step's `hint` now uses control names (`'attack' | 'jump' | 'roll' | 'power' | 'bag' | 'stick'`) instead of pill keys — update the expectations step by step from the current file (the tutorial's **text** keeps saying the same thing; only which control glows changes: 'block' → 'roll' with the line "Mantén Rodar para la guardia", 'lock' → none with the line "Toca al lobo para fijarlo", 'eat'/'campfire'/'wall'/'heart'/'trap' → 'bag'). This is a spec change: say so in the commit.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**
  - `touch.ts`: remove `PILL_BUTTONS` and the A/B defs; build the 5 buttons + MENÚ. Attack: `pointerdown` → `onAttackDown`, `pointerup` → `onAttackUp`, `pointercancel` → `onAttackUp`. Jump: hold flag `jump` (as today). Roll: `pointerdown` → `onRollDown` (game sets `input.block = true`, remembers time); `pointerup` → `onRollUp` (game: if held < 200 ms → `input.block = false; roll()`, else `input.block = false`). Power: tap (< 300 ms) → `onAction('KeyH')`; hold ≥ 300 ms → open `Wheel` with `onPowerWheel()` items, pick → `onAction(item.code)` (codes: `KeyR` for Arco, `PowerEnredadera` etc. → add `PowerSet:<kind>` handling in game that selects that power **and** casts it). Bag: tap → `onBag()`; hold ≥ 300 ms → `Wheel` with `onBagWheel()` (codes `Digit1`, `KeyB`, `KeyV`, `KeyG`, `TouchTrap`, `KeyM` for "Silbar" only when the call is available). Floating stick: the stick element is hidden until a `pointerdown` on the look layer's left half; then it appears centred there and that pointer drives it (reuse `moveStick`).
  - Tap-to-lock: in the look layer, a pointer that goes down and up within 250 ms and < 12 px movement calls `onTapWorld(x, y)`; `game.ts` raycasts from the camera through that point against enemy actors' roots (bounding sphere r = 1.2 m, paper actors 2 m) and sets/clears `lockId` (tapping the locked enemy again, or empty ground/sky, clears it). Returns true if it hit an enemy.
  - `setActIcon`: `game.ts` each frame calls it with the icon of `actOptions(probe)[0]` when exactly one option applies and no enemy is in reach, `'⋯'` when ≥ 2, and null (sword icon) otherwise.
  - `style.css`: new classes `.btn-attack`, `.btn-jump`, `.btn-roll`, `.btn-power`, `.btn-bag`, `.touch-stick.floating`, `.dim` (opacity 0.35), sizes ≥ 56 px; delete `.touch-pills` rules.
  - `guide-ui.ts` / `game.ts:1517-1520`: replace `setPills`/pill-index hints with `setDim` + `setHint(CONTROLS.map(...), stick)`; the P7-D "new" dots move to the bag/power buttons when a wheel item is new.
- [ ] **Step 4: Gate; commit**

```bash
git commit -am "feat(controles): móvil con 6 controles (atacar, saltar, rodar/guardia, poder y mochila con ruedas, menú), stick flotante y tocar para fijar"
```

---

### Task 9: Browser pass, tuning, HANDOFF, PR

**Files:**
- Modify: whatever the pass finds (`models.ts` `yawOffset`, hat offsets, pose numbers), `docs/superpowers/HANDOFF-aventura.md`, `CLAUDE.md` (Estado line: protocol 66, test counts)

- [ ] **Step 1:** `.dev.vars` with `ADMIN_TOKEN=dev-admin` if missing; start the dev server through the preview tool (`.claude/launch.json` entry `{ "name": "bosque", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev:server"], "port": 8787 }`), join a local test world.
- [ ] **Step 2: Check, with screenshots at 375×812 landscape (812×375) and desktop:**
  - The 4 bodies face forward when walking; hat sits on the head for each body; own helmet hidden with a hat.
  - Hammer E / Attack: swings 1-2-3, never frozen; buffered swing lands; hold → glow → spin hits two wolves.
  - Roll tap vs hold (guard, parry on a wolf bite); bow, cast, hurt, seat on the deer, cheer.
  - Trail + sparks + stagger visible; no console errors.
  - Phone: 6 controls, no overlap with the notch margins; wheels open/pick/cancel; A shows the chest icon near a chest and a wheel with chest + fogata together; tapping a wolf locks it.
  - Aspecto: 4 bodies × colour × skin repaint only clothes/skin; preview spins; another tab sees the change.
- [ ] **Step 3:** `npm run perf -- --tier low` — record draw calls/triangles in the HANDOFF.
- [ ] **Step 4:** HANDOFF: new section "Héroe, pelea y controles — resumen" (what changed, what to test on real phones first, every "Decidido por Claude — revisar", sizes, perf numbers); update the "ESTADO" block (protocol 66). `CLAUDE.md` Estado line.
- [ ] **Step 5:** Full gate; commit `docs: handoff héroe/pelea/controles`; `git push -u origin heroe/pelea-controles`; open the PR (`gh pr create`) with a summary, the phone screenshots and the test plan. **Do not merge** — Gabriel OKs merges (deploys to production).

---

## Self-review notes (planner)

- Spec §1 → Tasks 1–2; §1.1 table → `HERO_CLIPS` (Task 2) + anim picker (Task 4); §2.1 → Task 4; §2.2 → Task 3; §2.3 → Tasks 4–5; §3 → Tasks 3 (protocol/saves) + 6; §4 → Tasks 7–8; §5 tests are in each task; perf in Tasks 5 and 9.
- Old saves: `look` without `body/skin` → `isLook` accepts, `lookOf` defaults (Task 3 test "old looks stay valid").
- Old clients' `'attack'` anim stays valid in `ANIMS` and maps to `attack1` (Task 2 test).
