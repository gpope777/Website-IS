import type { StructureKind } from '../shared/items';

/** The two traps; the touch pill places the selected one (chosen in the Menú). */
export type TrapKind = Extract<StructureKind, 'spikes' | 'roots'>;

export const TRAP_LABEL: Record<TrapKind, string> = { spikes: 'estacas', roots: 'red de raíces' };

export function nextTrap(t: TrapKind): TrapKind {
  return t === 'spikes' ? 'roots' : 'spikes';
}
