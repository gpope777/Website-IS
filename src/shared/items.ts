export type ItemId = 'wood' | 'stone' | 'berries';
export type Inventory = Partial<Record<ItemId, number>>;

export const ITEMS: readonly ItemId[] = ['wood', 'stone', 'berries'];
export const ITEM_LABELS: Record<ItemId, string> = { wood: 'Madera', stone: 'Piedra', berries: 'Bayas' };

export type StructureKind = 'campfire' | 'wall' | 'heart' | 'spikes';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall', 'heart', 'spikes'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro', heart: 'Corazón del Bosque', spikes: 'Estacas' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
  heart: { wood: 20, stone: 10 },
  spikes: { wood: 3, stone: 1 },
};
export const STRUCTURE_HP: Record<StructureKind, number> = { campfire: 60, wall: 150, heart: 500, spikes: 80 };
/** Tending the Heart: berries in, HP back. */
export const TEND_COST: Inventory = { berries: 5 };
export const TEND_HEAL = 100;

export function count(inv: Inventory, item: ItemId): number {
  return inv[item] ?? 0;
}

export function addItem(inv: Inventory, item: ItemId, n: number): Inventory {
  return { ...inv, [item]: count(inv, item) + n };
}

export function hasAll(inv: Inventory, cost: Inventory): boolean {
  return (Object.keys(cost) as ItemId[]).every((k) => count(inv, k) >= (cost[k] ?? 0));
}

export function removeAll(inv: Inventory, cost: Inventory): Inventory {
  if (!hasAll(inv, cost)) throw new Error('not enough items');
  const out: Inventory = { ...inv };
  for (const k of Object.keys(cost) as ItemId[]) {
    const left = count(out, k) - (cost[k] ?? 0);
    if (left > 0) out[k] = left;
    else delete out[k];
  }
  return out;
}
