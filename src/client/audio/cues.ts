/** P7-B (spec §4.2): what the game says → which sound. Pure; the engine plays the cues. */
import type { Action } from '../input';
import type { EnemyKind, FxView, WolfAnim } from '../../shared/protocol';
import type { SfxId } from './sfx';

export interface Cue { id: SfxId; x?: number; z?: number }

export interface SnapLike {
  wolves: { id: number; kind: EnemyKind; x: number; z: number; anim: WolfAnim; aim?: unknown }[];
  fx?: FxView[];
  self: { hurt?: number; dead: boolean; vitals: { health: number } };
  raid: { phase: 'warn' | 'active' } | null;
  marchito: { laughing: boolean } | null;
  /** Boss/elite wind-ups seen in the dungeon views, as stable keys ("coast:sweep", "mountain:windup"…). */
  tells?: string[];
}

export const HEARTBEAT = { every: 1.1, below: 0.25 } as const;

const TELL: Partial<Record<EnemyKind, SfxId>> = { wolf: 'lobo-aviso', brute: 'bruto-carga', rayo: 'rayo-zumbido' };

/** Remembers the last snapshot so wind-ups sound once, on the transition, like the visual tell. */
export class CueTracker {
  private anims = new Map<number, WolfAnim>();
  private aims = new Set<number>();
  private tells = new Set<string>();
  private raidWarn = false;
  private laughing = false;
  private beatAt = -Infinity;

  snap(m: SnapLike, me: string, now: number): Cue[] {
    const out: Cue[] = [];
    const byId = new Map(m.wolves.map((w) => [w.id, w]));
    for (const f of m.fx ?? []) {
      const w = byId.get(f.id);
      const id: SfxId = f.kind === 'kill' ? 'golpe-final' : f.kind === 'parry' ? 'parada' : f.kind === 'block' ? 'bloqueo' : 'golpe';
      out.push(f.by === me || !w ? { id } : { id, x: w.x, z: w.z });
    }
    if ((m.self.hurt ?? 0) > 0) out.push({ id: 'dano' });
    const anims = new Map<number, WolfAnim>();
    const aims = new Set<number>();
    for (const w of m.wolves) {
      anims.set(w.id, w.anim);
      const before = this.anims.get(w.id);
      const tell = TELL[w.kind] ?? (w.kind !== 'brote' && w.kind !== 'anchor' ? 'jefe-aviso' : undefined);
      if (tell && w.anim === 'attack' && before !== undefined && before !== 'attack') out.push({ id: tell, x: w.x, z: w.z });
      if (w.aim) {
        aims.add(w.id);
        if (!this.aims.has(w.id)) out.push({ id: 'jefe-aviso', x: w.x, z: w.z });
      }
    }
    this.anims = anims;
    this.aims = aims;
    const tells = new Set(m.tells ?? []);
    for (const t of tells) if (!this.tells.has(t)) out.push({ id: 'jefe-aviso' });
    this.tells = tells;
    const warn = m.raid?.phase === 'warn';
    if (warn && !this.raidWarn) out.push({ id: 'cuerno' });
    this.raidWarn = warn;
    const laughing = !!m.marchito?.laughing;
    if (laughing && !this.laughing) out.push({ id: 'marchito' });
    this.laughing = laughing;
    if (!m.self.dead && m.self.vitals.health < HEARTBEAT.below * 100 && now - this.beatAt >= HEARTBEAT.every) {
      this.beatAt = now;
      out.push({ id: 'latido' });
    }
    return out;
  }
}

const ACTION: Partial<Record<Action, SfxId>> = {
  roll: 'rodar',
  bow: 'arco-tensar',
  campfire: 'construir',
  wall: 'construir',
  heart: 'construir',
  spikes: 'construir',
  net: 'construir',
  fire: 'construir',
  tower: 'construir',
  menu: 'menu',
  switch: 'boton',
  camera: 'boton',
  trap: 'boton',
  lock: 'boton',
};
export function actionCue(a: Action): SfxId | null {
  return ACTION[a] ?? null;
}

export const POWER_CUE: Record<'enredadera' | 'viento' | 'fuego' | 'piedra', SfxId> = { enredadera: 'enredadera', viento: 'viento', fuego: 'fuego', piedra: 'piedra' };

/** "No puedes" toasts sound dull; the rest get the soft toast chime. */
export function toastCue(text: string): SfxId {
  return /^(Aún no|No |Nada|Falta|Te falta|Necesitas)/.test(text) ? 'no' : 'toast';
}
