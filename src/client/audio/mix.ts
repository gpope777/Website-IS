/** P7-B (spec §4.1, §4.3–4.5): the pure side of the mix — voices, distance, buses, ambience, music, unlock. */
import type { Settings } from '../settings';
import type { Biome } from '../scene/looks';
import type { Bus, VoiceClass } from './sfx';

export const AUDIO = { voices: 12, range: 40, tellRange: 60, tellFloor: 0.5, tellFar: 0.3, jitter: 0.06, fade: 3, pan: 0.8 } as const;

interface Voice { id: number; cls: VoiceClass; tell: boolean; at: number }

/** ≤ 12 voices; a new one cuts the oldest of its class, else the oldest overall. Tells are never cut. */
export class Voices {
  private list: Voice[] = [];
  /** Registers the voice; returns the id of a voice to stop, or null. */
  start(id: number, cls: VoiceClass, tell: boolean, now: number): number | null {
    let cut: number | null = null;
    if (this.list.length >= AUDIO.voices) {
      const pool = this.list.filter((v) => !v.tell);
      const same = pool.filter((v) => v.cls === cls);
      const pick = (same.length ? same : pool).reduce<Voice | null>((a, v) => (!a || v.at < a.at ? v : a), null);
      if (pick) {
        cut = pick.id;
        this.end(pick.id);
      }
    }
    this.list.push({ id, cls, tell, at: now });
    return cut;
  }
  end(id: number): void {
    this.list = this.list.filter((v) => v.id !== id);
  }
  get size(): number {
    return this.list.length;
  }
}

/** Gain by distance and stereo pan from the camera yaw (yaw 0 looks toward −Z; right = (cos yaw, −sin yaw)). */
export function spatial(lx: number, lz: number, yaw: number, sx: number, sz: number, tell: boolean): { gain: number; pan: number } {
  const dx = sx - lx;
  const dz = sz - lz;
  const d = Math.hypot(dx, dz);
  let gain = d >= AUDIO.range ? 0 : (1 - d / AUDIO.range) ** 2;
  if (tell) gain = Math.max(gain, d <= AUDIO.tellRange ? AUDIO.tellFloor : AUDIO.tellFar);
  const pan = d < 0.5 ? 0 : Math.max(-AUDIO.pan, Math.min(AUDIO.pan, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d));
  return { gain, pan };
}

/** ±6 % pitch from a random number in [0, 1). */
export function jitter(rand: number): number {
  return 1 + (rand * 2 - 1) * AUDIO.jitter;
}

const perceptual = (v: number) => (Math.max(0, Math.min(100, v)) / 100) ** 2;

export function busGains(s: Settings, hidden: boolean): Record<'master' | Bus, number> {
  return {
    master: s.mute || hidden ? 0 : perceptual(s.master),
    sfx: perceptual(s.sfx),
    ui: perceptual(s.sfx),
    ambient: perceptual(s.amb),
    music: perceptual(s.music),
  };
}

export type AmbLayer = 'hojas' | 'grillos' | 'olas' | 'pantano' | 'viento' | 'grave' | 'lluvia';
export const AMB_LAYERS: AmbLayer[] = ['hojas', 'grillos', 'olas', 'pantano', 'viento', 'grave', 'lluvia'];

/** Layer gains (0–1) from the biome weights (the sky's crossfade), time of day, height and weather. */
export function ambienceGains(w: Partial<Record<Biome, number>>, o: { day: boolean; height: number; rain: boolean; storm: boolean; ending: boolean }): Record<AmbLayer, number> {
  const tierras = w.tierras ?? 0;
  const bosque = (w.bosque ?? 0) + (o.ending ? tierras : 0);
  const g: Record<AmbLayer, number> = { hojas: 0, grillos: 0, olas: 0, pantano: 0, viento: 0, grave: 0, lluvia: 0 };
  if (o.day) g.hojas = bosque * 0.6;
  else g.grillos = (bosque + (w.costa ?? 0) * 0.5) * 0.5;
  g.olas = (w.costa ?? 0) * 0.8;
  g.pantano = (w.pantano ?? 0) * 0.6;
  g.viento = (w.montanas ?? 0) * Math.min(1, 0.3 + Math.max(0, o.height) / 120) * (o.storm ? 1.5 : 1) * 0.6;
  g.grave = o.ending ? 0 : tierras * 0.7;
  g.lluvia = o.rain ? (o.storm ? 0.8 : 0.5) : 0;
  for (const k of AMB_LAYERS) g[k] = Math.min(1, g[k]);
  return g;
}

export const BIOMES: Biome[] = ['bosque', 'costa', 'pantano', 'montanas', 'tierras'];
export const musicUrl = (name: string) => `/audio/musica-${name}.ogg`;
export const MUSIC_NAMES = [...BIOMES, 'asedio', 'jefe'];

/** Which drop-in track should play: jefe > asedio > bioma; null = silence. */
export function musicTrack(have: ReadonlySet<string>, o: { biome: Biome; raid: boolean; boss: boolean }): string | null {
  if (o.boss && have.has('jefe')) return 'jefe';
  if (o.raid && have.has('asedio')) return 'asedio';
  return have.has(o.biome) ? o.biome : null;
}

export function dominant(w: Partial<Record<Biome, number>>): Biome {
  let best: Biome = 'bosque';
  let v = -1;
  for (const b of BIOMES) if ((w[b] ?? 0) > v) (best = b), (v = w[b] ?? 0);
  return best;
}

/** iOS: 'warn' once when the context is still not running after 2 gestures. */
export class Unlock {
  private n = 0;
  private warned = false;
  gesture(running: boolean): 'ok' | 'warn' | null {
    if (running) return 'ok';
    this.n++;
    if (this.n >= 2 && !this.warned) {
      this.warned = true;
      return 'warn';
    }
    return null;
  }
}
export const MUTED_WARNING = 'Sin sonido: revisa el interruptor del móvil';

export type Surface = 'hierba' | 'arena' | 'roca' | 'nieve' | 'agua';
export function surface(biome: Biome, y: number, swimming: boolean): Surface {
  if (swimming) return 'agua';
  if (biome === 'costa' && y < 3) return 'arena';
  if (biome === 'montanas') return y > 60 ? 'nieve' : 'roca';
  return 'hierba';
}
