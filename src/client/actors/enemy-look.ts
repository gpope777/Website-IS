import type { DungeonView, EnemyKind } from '../../shared/protocol';
import type { Biome } from '../scene/looks';

/** V2-E: the fox-model enemies get a colour per type (spec §6.2): one shared material per `key`, not per instance. */
export interface EnemyLook {
  key: string;
  /** Multiplies the fox texture. */
  color: number;
  emissive: number;
  scale: number;
}

const LOOKS: Record<string, Omit<EnemyLook, 'scale'>> = {
  wolf: { key: 'wolf', color: 0xb8c4d0, emissive: 0x000000 },
  ash: { key: 'ash', color: 0x8a8480, emissive: 0x3a1206 },
  brute: { key: 'brute', color: 0x9a6a8a, emissive: 0x000000 },
  elite: { key: 'elite', color: 0x3a3040, emissive: 0x2a0a3a },
  elite2: { key: 'elite2', color: 0x7a98b8, emissive: 0x000000 },
  elite3: { key: 'elite3', color: 0x8a8a4a, emissive: 0x000000 },
  elite4: { key: 'elite4', color: 0xa8a8a0, emissive: 0x000000 },
};

/** The look of a fox-drawn enemy, or null for the ones drawn on paper (and the anchor). Scales are today's. */
export function enemyLook(kind: EnemyKind, biome: Biome, raid: boolean): EnemyLook | null {
  switch (kind) {
    case 'wolf':
      return { ...LOOKS[biome === 'tierras' ? 'ash' : 'wolf']!, scale: raid ? 1.3 : 1 };
    case 'brute':
      return { ...LOOKS.brute!, scale: 1.8 };
    case 'elite':
    case 'elite2':
    case 'elite3':
    case 'elite4':
      return { ...LOOKS[kind]!, scale: 2.4 };
    default:
      return null;
  }
}

/** Which dungeon brutes are winding a charge right now (the server already sends it; this only draws it). */
export function chargingKinds(d: Pick<DungeonView, 'elite' | 'coast' | 'swamp' | 'mountain'>): EnemyKind[] {
  const out: EnemyKind[] = [];
  if (d.elite?.charging) out.push('elite');
  if (d.coast?.elite?.charging) out.push('elite2');
  if (d.swamp?.elite?.charging) out.push('elite3');
  if (d.mountain?.elite?.charging) out.push('elite4');
  return out;
}
