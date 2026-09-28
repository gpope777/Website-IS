import type { StructureKind } from '../shared/items';
import { NAMES } from '../shared/names';

/** The four traps; the touch pill places the selected one (chosen in the Menú). The hoguera needs Fuego, the torre Piedra. */
export type TrapKind = Extract<StructureKind, 'spikes' | 'roots' | 'fire' | 'tower'>;

export const TRAP_LABEL: Record<TrapKind, string> = { spikes: 'estacas', roots: 'red de raíces', fire: 'hoguera', tower: NAMES.tower };

/** Estacas → red de raíces → hoguera (only with Fuego) → torre (only with Piedra) → estacas. */
export function nextTrap(t: TrapKind, fuego = false, piedra = false): TrapKind {
  const order: TrapKind[] = ['spikes', 'roots', ...(fuego ? (['fire'] as const) : []), ...(piedra ? (['tower'] as const) : [])];
  const i = order.indexOf(t);
  return order[(i + 1) % order.length]!;
}
