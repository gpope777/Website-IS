import { NAMES } from './names';
export type ItemId = 'wood' | 'stone' | 'berries' | 'pearl' | 'amber' | 'quartz';
export type Inventory = Partial<Record<ItemId, number>>;

export const ITEMS: readonly ItemId[] = ['wood', 'stone', 'berries', 'pearl', 'amber', 'quartz'];
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
export const ITEM_LABELS: Record<ItemId, string> = { wood: 'Madera', stone: 'Piedra', berries: 'Bayas', pearl: `${cap(NAMES.pearl)}s`, amber: cap(NAMES.amber), quartz: cap(NAMES.quartz) };

export type StructureKind = 'campfire' | 'wall' | 'heart' | 'spikes' | 'roots' | 'fire';
export const STRUCTURE_KINDS: readonly StructureKind[] = ['campfire', 'wall', 'heart', 'spikes', 'roots', 'fire'];
export const STRUCTURE_LABELS: Record<StructureKind, string> = { campfire: 'Fogata', wall: 'Muro', heart: `${NAMES.heart}`, spikes: 'Estacas', roots: 'Red de raíces', fire: 'Hoguera' };
export const BUILD_COST: Record<StructureKind, Inventory> = {
  campfire: { wood: 5, stone: 3 },
  wall: { wood: 4 },
  heart: { wood: 20, stone: 10 },
  spikes: { wood: 3, stone: 1 },
  /** Red de raíces: holds a raider in place for a few seconds. */
  roots: { wood: 4, berries: 2 },
  /** Hoguera: a fire trap (needs Fuego). */
  fire: { wood: 4, amber: 2 },
};
export const STRUCTURE_HP: Record<StructureKind, number> = { campfire: 60, wall: 150, heart: 500, spikes: 80, roots: 60, fire: 60 };
/** Tending the Heart: berries in, HP back. */
export const TEND_COST: Inventory = { berries: 5 };
export const TEND_HEAL = 100;
/** Weapon upgrade at the Heart (spec §6.2, S4 §5.3): levels 1–3 cost pearls, 4–5 cost mountain quartz; +15 % damage per level. */
export const UPGRADE = { cost: { pearl: 3, stone: 10, wood: 5 }, costHigh: { quartz: 3, stone: 10, wood: 5 }, pearlMax: 3, step: 0.15, max: 5 } as const;

/** What the next level costs, from level `lvl`. */
export function upgradeCost(lvl: number): Inventory {
  return lvl < UPGRADE.pearlMax ? UPGRADE.cost : UPGRADE.costHigh;
}

export function weaponMult(lvl: number): number {
  return 1 + UPGRADE.step * Math.max(0, Math.min(UPGRADE.max, Math.floor(lvl)));
}

/** Capa de corteza (spec S3 §6.3): amber from the swamp; −10 % damage taken per level, never the terrain bites. */
export const CAPA = { cost: { amber: 3, wood: 10, berries: 5 }, step: 0.1, max: 3 } as const;

export function capaMult(lvl: number): number {
  return 1 - CAPA.step * Math.max(0, Math.min(CAPA.max, Math.floor(lvl)));
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
