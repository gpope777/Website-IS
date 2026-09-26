export type ItemId = 'wood' | 'stone' | 'berries';
export type Inventory = Partial<Record<ItemId, number>>;

export const ITEMS: readonly ItemId[] = ['wood', 'stone', 'berries'];
export const ITEM_LABELS: Record<ItemId, string> = { wood: 'Madera', stone: 'Piedra', berries: 'Bayas' };

export type StructureKind = 'campfire' | 'wall';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
};

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
