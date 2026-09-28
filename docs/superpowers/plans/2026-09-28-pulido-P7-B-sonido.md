# Pulido · P7-B: Sonido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** row P7-B of the spec's plan map (§14). The game has no sound at all today. (1) **A synth written here** (zzfx-style, no dependency, no download): each effect is one row of numbers, rendered **once** to a `Float32Array` → `AudioBuffer` when audio starts, played back with ±6 % pitch jitter. (2) **~40 effects** mapped to actions, blows, UI, mounts, powers and boss/enemy tells; **tells are always audible**, even off-screen. (3) **Ambience per biome**, procedural (looped filtered noise + small random events), crossfaded with the existing `biomeWeights`, plus rain/storm and a dungeon reverb. (4) **Buses** `master → sfx / ui / ambient / music` with volumes (General, Efectos, Ambiente, Música 0–100) and **Silencio** (key `.`, 🔇 in the Menú); muted while the tab is hidden. (5) **Music "suelta y listo"**: `/audio/musica-<bioma>.ogg`, `musica-asedio.ogg`, `musica-jefe.ogg` play in a loop with a 3 s fade if they exist (HEAD like `loadDropIns`); silence otherwise. (6) **iOS**: the `AudioContext` is created on the first touch/click/key, `resume()` on tab return, and "Sin sonido: revisa el interruptor del móvil" if it is still suspended after 2 touches.

**Architecture:** pure and tested (no `AudioContext`): `src/client/audio/synth.ts` (params → samples, seeded noise), `src/client/audio/sfx.ts` (the table: `SFX: Record<SfxId, SfxDef>` with `bus`, `cls`, `tell?`), `src/client/audio/mix.ts` (voice limiter, distance/pan, pitch jitter, bus gains from settings, ambience layer gains, music choice, unlock/mute-warning state), `src/client/audio/cues.ts` (snapshot/message/action → cue list: fx, hurt, enemy wind-ups by anim transition, raid warn, low-health heartbeat, rank up, toasts that mean "no puedes"). Wiring: `src/client/audio/engine.ts` (the only file that touches WebAudio: context, buses, buffers, `StereoPannerNode` per voice, ambience nodes, convolver, music `<audio>`-free `AudioBufferSourceNode`s via `decodeAudioData`), `settings.ts` gains the volume fields, `hud.ts` gains the sliders + 🔇, `game.ts` feeds cues, `join.ts` gets the headphones line.

**Tech Stack:** TypeScript, WebAudio, Vite, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-28-pulido-design.md` §4.1–4.6, §8.4 (entry line), §13 (iOS risk, "8 bits" risk), §14 (P7-B).

## Global Constraints

- **No gameplay, balance or protocol change.** Everything is client-side and reads what the snapshot already sends (`fx`, `self.hurt`, `WolfView.anim`, boss `tell`/`windup`, `raid.phase`). `PROTOCOL_VERSION` stays 63.
- **No new dependency, no downloaded asset.** Music files are optional drop-ins; their absence is silent and error-free.
- **Cheap on phones:** ≤ 12 simultaneous voices (the oldest of the same class is cut; else the oldest overall), `StereoPannerNode` not HRTF, buffers rendered once (≈ 40 × ≤ 0.6 s mono at the context rate, < 2 MB), ambience = ≤ 6 looping noise sources with filters whose gains move ≤ 4 times a second. Audio code does no work per frame while muted or suspended. No render-call cost (the perf harness must stay equal).
- **Touch grid ≤ 10 pills:** unchanged; the 🔇 lives in the Menú.
- Spanish player-facing text, dry voice. `npm test && npm run test:workers && npm run check && npm run build` before every commit. Commits end with the Co-Authored-By + Claude-Session lines. Push after each task.

## Decisions (Decidido por Claude — revisar)

- **[D] Synth params** (`SfxDef`): `wave` (`sine | square | saw | tri | noise`), `freq`, `slide` (Hz/s, exponential-ish sweep), `attack`, `sustain`, `decay` (s; total ≤ 0.6), `vol`, `lp?` (one-pole low-pass cutoff Hz), `hp?`, `trem?` (Hz, depth 0.5), `vib?` (Hz, ±3 %), `noise?` (0–1 mixed into tonal waves), `chord?` (extra frequency ratios), `echo?` (s, one repeat at 0.35). Deterministic: noise from a seeded LCG per id, so a test can pin a render.
- **[D] 12 voices**, classes `step | hit | tell | ui | world | loop`. Tells (`tell: true`) ignore distance attenuation below a floor of 0.5 gain and are never the voice that gets cut (another voice is cut instead).
- **[D] Positioned sounds:** gain `(1 − d/40)²`, silent past 40 m (except tells: floor 0.5 up to 60 m, then 0.3); pan = `sin(angle between camera yaw and the source)` clamped ±0.8.
- **[D] Tells:** a wolf/brute/rayo whose `anim` goes to `attack` → its wind-up sound once (`lobo-aviso`, `bruto-carga`, `rayo-zumbido`); El Antenón `tell` sweep/charge, El Cucurucho `windup`, La Flecha `aim` appearing → `jefe-aviso`. Sounded the snapshot the tell appears, which is the same moment the visual tell starts.
- **[D] Footsteps** from my own movement only (every 0.42 m·s-adjusted stride while walking on the ground): surface from biome + height (sand on the coast below 3 m, snow above 60 m in the mountains, rock in the mountains, water when swimming, grass otherwise). Friends' steps are not played (voice budget).
- **[D] Heartbeat** every 1.1 s while health < 25 % and alive (ui bus, so it is heard over ambience).
- **[D] "No puedes"**: any toast that starts with "Aún no", "No ", "Nada" or "Falta" plays the dull `no`; every other toast plays `toast`.
- **[D] Ambience layers:** `hojas` (bosque day), `grillos` (bosque/costa night), `olas` (costa), `pantano`, `viento` (montañas; gain grows with height, ×1.5 in storm), `grave` (tierras, corrupt; after the ending it follows the bosque mix), `lluvia` (precip), plus random events every 3–9 s: bird chirp (bosque day), frog croak (pantano), bubble (pantano). Mixed with `biomeWeights` (the existing ≈ 30 m crossfade; the spec says 20 m — close enough, and reuses what the sky already uses). Dungeons: one `ConvolverNode` with a synthetic 1.6 s decaying-noise impulse, sfx bus dry/wet 0/0.35 when inside.
- **[D] Thunder** is played when the sky's lightning flash fires (existing weather code), delayed 0.4–1.5 s.
- **[D] Music:** HEAD `/audio/musica-<bosque|costa|pantano|montanas|tierras>.ogg`, `musica-asedio.ogg`, `musica-jefe.ogg` at start; priority jefe > asedio > bioma (the dominant `biomeWeights` entry); 3 s crossfade; a missing track = silence. Decoded lazily on first use.
- **[D] Settings** in the same `bosque.settings` key: `master`, `sfx`, `amb`, `music` (0–100, defaults 80/80/60/60) and `mute` (false). Gain = `(v/100)²` (perceptual). Four range inputs and a "Silencio" select in the Menú; key `.` toggles mute (toast "Silencio" / "Con sonido").
- **[D] Unlock:** the first `pointerdown`/`keydown`/`touchend` creates the context and plays a 1-sample silent buffer (iOS rule). If the context is still not `running` after 2 such gestures → toast "Sin sonido: revisa el interruptor del móvil" once. `visibilitychange` hidden → master to 0 + `suspend()`; visible → `resume()` + master back.

## File Structure

- Create `src/client/audio/synth.ts` (+test), `src/client/audio/sfx.ts` (+test), `src/client/audio/mix.ts` (+test), `src/client/audio/cues.ts` (+test), `src/client/audio/engine.ts`.
- Modify `src/client/settings.ts` (+ tests in `audio/mix.test.ts`), `src/client/hud.ts`, `src/client/game.ts`, `src/client/join.ts`, `src/client/input.ts` (`Period` → `mute`).

## Tasks

### Task 1: pure — synth and the effect table

```ts
// synth.ts
export type Wave = 'sine' | 'square' | 'saw' | 'tri' | 'noise';
export interface SfxDef { wave: Wave; freq: number; slide?: number; attack: number; sustain: number; decay: number; vol: number; lp?: number; hp?: number; trem?: number; vib?: number; noise?: number; chord?: number[]; echo?: number }
export function renderSfx(d: SfxDef, rate: number, seed?: number): Float32Array;   // peak ≤ 1
export function sfxLength(d: SfxDef): number;                                     // seconds
// sfx.ts
export type Bus = 'sfx' | 'ui' | 'ambient' | 'music';
export type VoiceClass = 'step' | 'hit' | 'tell' | 'ui' | 'world';
export interface SfxEntry extends SfxDef { bus: Bus; cls: VoiceClass; tell?: true }
export const SFX: Record<SfxId, SfxEntry>;   // ≈ 40
```

- [ ] **Step 1: failing tests.** Every entry renders non-silent, ≤ 0.6 s (echo included), peak ≤ 1, no NaN; same seed → same samples; noise differs from sine; `lp` lowers high-frequency energy (zero-crossing count drops); ≥ 38 entries; every group in §4.2 present (steps ×5, powers ×4, tells, ui, mounts); every `tell: true` entry has class `tell`.
- [ ] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): sintetizador de efectos y los ~40 sonidos (puro)`.

### Task 2: pure — mixing, cues, settings

```ts
// mix.ts
export const AUDIO = { voices: 12, range: 40, tellRange: 60, jitter: 0.06, fade: 3 } as const;
export class Voices { start(id: number, cls: VoiceClass, tell: boolean, now: number): number | null /* id to cut */; end(id: number): void; get size(): number }
export function spatial(lx: number, lz: number, yaw: number, sx: number, sz: number, tell: boolean): { gain: number; pan: number };
export function jitter(rand: number): number;                // 0.94–1.06
export function busGains(s: Settings, hidden: boolean): Record<'master' | Bus, number>;
export function ambienceGains(w: Partial<Record<Biome, number>>, o: { day: boolean; height: number; rain: boolean; storm: boolean; ending: boolean }): Record<AmbLayer, number>;
export function musicTrack(have: Set<string>, o: { biome: Biome; raid: boolean; boss: boolean }): string | null;
export class Unlock { gesture(running: boolean): 'ok' | 'warn' | null }  // 'warn' once after 2 suspended gestures
export function surface(biome: Biome, y: number, swimming: boolean): 'hierba' | 'arena' | 'roca' | 'nieve' | 'agua';
// cues.ts
export interface Cue { id: SfxId; x?: number; z?: number }
export class CueTracker { snap(m: SnapLike, me: string): Cue[]; }   // fx, hurt, tells by transition, raid warn, heartbeat timer
export function actionCue(a: Action): SfxId | null;
export function toastCue(text: string): SfxId;
// settings.ts: Settings += { master, sfx, amb, music: number; mute: boolean }
```

- [ ] **Step 1: failing tests.** `Voices`: 13th voice cuts the oldest of its class, else oldest; tells never cut; `end` frees. `spatial`: 0 m → 1, 40 m → 0, 20 m → 0.25; tell at 50 m → 0.5; source to the right → pan > 0 (pinned against the camera yaw convention in `camera-rig.ts`); clamp ±0.8. `jitter` bounds. `busGains`: mute → master 0; hidden → 0; 50 → 0.25. `ambienceGains`: pure bosque day → hojas only (+ no grillos); night → grillos; montañas height 0 vs 100 grows viento; rain → lluvia; tierras after the ending → bosque layers. `musicTrack`: empty set → null; jefe > asedio > bioma; missing biome track → null. `Unlock`: running first → ok; suspended twice → warn once. `surface`. `CueTracker`: my hit → `golpe`, kill → `golpe-final`, parry → `parada`, block → `bloqueo`; friend's hit positioned at the enemy; `hurt` → `dano`; wolf idle→attack → `lobo-aviso` once, not again while it stays `attack`; raid `warn` appears → `cuerno` once; low health heartbeat every 1.1 s, none when dead. `actionCue`: power/roll/bow/mount/menu mapped. `toastCue`. `parseSettings` keeps the new fields in range (bad → defaults; 150 → 100).
- [ ] **Step 2: implement.** **Step 3:** green, commit `feat(pulido): mezcla, voces, ambiente, música y señales de sonido (puro)`.

### Task 3: engine and wiring

- [ ] **Step 1:** `engine.ts`: `AudioEngine.unlock()` (creates context on a gesture, renders `SFX` into buffers in idle slices), `play(id, pos?)` (jitter, `Voices`, `StereoPannerNode`, bus), `setListener(x, z, yaw)`, `ambience(gains, dungeon)` (6 looping noise buffers through `BiquadFilterNode`s; random events), `thunder()`, `music(track)` (HEAD probe once; decode on first use; 3 s crossfade), `setGains(busGains)`, `state` for the warn. `game.ts`: gesture listeners → unlock/`Unlock` warn toast; `onSnap` → `CueTracker` → `play`; `onAction` → `actionCue`; toasts → `toastCue`; frame → listener, footsteps, ambience (≤ 4 Hz), music choice; lightning → thunder; menu sliders + Silencio; `Period` → mute toggle; `visibilitychange`. `hud.ts`: 4 range inputs + Silencio select. `join.ts`: "Bosque. Juego cooperativo. Con auriculares se oye mejor."
- [ ] **Step 2:** harness `npm run perf -- --tier low` (audio adds no draw calls). Green, commit `feat(pulido): sonido en el juego: efectos, avisos, ambiente, música y volumen`.

### Task 4: Ship

- [ ] HANDOFF "## Pulido · P7-B — …" (Decidido por Claude — revisar, Qué probar, NO verificado, perf incl. P7-A medium/high); push; one short comment on PR #3.
