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
  wolf: { key: 'wolf', color: 0x8a96a8, emissive: 0x000000 },
  ash: { key: 'ash', color: 0x6a6664, emissive: 0x240a04 },
  brute: { key: 'brute', color: 0x8a4a78, emissive: 0x000000 },
  elite: { key: 'elite', color: 0x2a2232, emissive: 0x30104a },
  elite2: { key: 'elite2', color: 0x4a7aa8, emissive: 0x000000 },
  elite3: { key: 'elite3', color: 0x6a6a2a, emissive: 0x000000 },
  elite4: { key: 'elite4', color: 0x9a9a92, emissive: 0x000000 },
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
