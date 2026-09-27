import type { StructureKind } from '../shared/items';

/** The three traps; the touch pill places the selected one (chosen in the Menú). The hoguera needs Fuego. */
export type TrapKind = Extract<StructureKind, 'spikes' | 'roots' | 'fire'>;

export const TRAP_LABEL: Record<TrapKind, string> = { spikes: 'estacas', roots: 'red de raíces', fire: 'hoguera' };

/** Estacas → red de raíces → hoguera (only with Fuego) → estacas. */
export function nextTrap(t: TrapKind, fuego = false): TrapKind {
  if (t === 'spikes') return 'roots';
  if (t === 'roots' && fuego) return 'fire';
  return 'spikes';
}
