import { NAMES } from './names';
export type ItemId = 'wood' | 'stone' | 'berries' | 'pearl';
export type Inventory = Partial<Record<ItemId, number>>;

export const ITEMS: readonly ItemId[] = ['wood', 'stone', 'berries', 'pearl'];
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
export const ITEM_LABELS: Record<ItemId, string> = { wood: 'Madera', stone: 'Piedra', berries: 'Bayas', pearl: `${cap(NAMES.pearl)}s` };

export type StructureKind = 'campfire' | 'wall' | 'heart' | 'spikes' | 'roots';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall', 'heart', 'spikes', 'roots'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro', heart: `${NAMES.heart}`, spikes: 'Estacas', roots: 'Red de raíces' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
  heart: { wood: 20, stone: 10 },
  spikes: { wood: 3, stone: 1 },
  /** Red de raíces: holds a raider in place for a few seconds. */
  roots: { wood: 4, berries: 2 },
};
export const STRUCTURE_HP: Record<StructureKind, number> = { campfire: 60, wall: 150, heart: 500, spikes: 80, roots: 60 };
/** Tending the Heart: berries in, HP back. */
export const TEND_COST: Inventory = { berries: 5 };
export const TEND_HEAL = 100;
/** Weapon upgrade at the Heart (spec §6.2): pearls from the sunken chests plus a fixed cost; +15 % damage per level. */
export const UPGRADE = { cost: { pearl: 3, stone: 10, wood: 5 }, step: 0.15, max: 3 } as const;

export function weaponMult(lvl: number): number {
  return 1 + UPGRADE.step * Math.max(0, Math.min(UPGRADE.max, Math.floor(lvl)));
}

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
