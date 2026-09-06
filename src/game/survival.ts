/**
 * Pure survival simulation. No rendering, no DOM. Everything here is unit-testable.
 * Units: time in real seconds; stats are 0..100.
 */

export interface Stats {
  health: number;
  hunger: number; // 100 = full
  thirst: number; // 100 = hydrated
  energy: number; // 100 = rested
  warmth: number; // 100 = warm
}

export interface Environment {
  /** 0..1 fraction of the day; 0 = midnight, 0.5 = noon */
  dayFraction: number;
  nearFire: boolean;
  sheltered: boolean;
  moving: boolean;
  sprinting: boolean;
}

export const STAT_MAX = 100;

/** Per-second drain rates at rest. Tuned so a full bar lasts a few in-game days. */
export const RATES = {
  hunger: 100 / (8 * 60), // empty in 8 real minutes (~2 in-game days)
  thirst: 100 / (5 * 60),
  energyMoving: 100 / (6 * 60),
  energySprinting: 100 / (2 * 60),
  energyRestRecover: 100 / (60), // full recovery in one minute of rest
  warmthNight: 100 / (3 * 60),
  warmthFire: 100 / 20,
  starvationDamage: 100 / (2 * 60),
  dehydrationDamage: 100 / (90),
  coldDamage: 100 / (100),
  exhaustionDamage: 100 / (4 * 60),
  regen: 100 / (5 * 60),
} as const;

export function clamp(v: number, lo = 0, hi = STAT_MAX): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createStats(): Stats {
  return { health: 100, hunger: 100, thirst: 100, energy: 100, warmth: 100 };
}

export function isNight(dayFraction: number): boolean {
  const f = ((dayFraction % 1) + 1) % 1;
  return f < 0.22 || f > 0.8;
}

/** Ambient temperature as 0..1 comfort. Coldest at ~03:00, warmest at ~14:00. */
export function ambientWarmth(dayFraction: number): number {
  const f = ((dayFraction % 1) + 1) % 1;
  return 0.5 - 0.5 * Math.cos((f - 0.12) * Math.PI * 2);
}

export function tick(stats: Stats, env: Environment, dt: number): Stats {
  const s = { ...stats };
  const workFactor = env.sprinting ? 2 : env.moving ? 1.3 : 1;

  s.hunger = clamp(s.hunger - RATES.hunger * workFactor * dt);
  s.thirst = clamp(s.thirst - RATES.thirst * workFactor * dt);

  if (env.sprinting) s.energy = clamp(s.energy - RATES.energySprinting * dt);
  else if (env.moving) s.energy = clamp(s.energy - RATES.energyMoving * dt);
  else s.energy = clamp(s.energy + RATES.energyRestRecover * 0.25 * dt);

  const comfort = ambientWarmth(env.dayFraction);
  if (env.nearFire) {
    s.warmth = clamp(s.warmth + RATES.warmthFire * dt);
  } else {
    const exposure = (1 - comfort) * (env.sheltered ? 0.35 : 1);
    const drain = RATES.warmthNight * exposure - (comfort > 0.7 ? RATES.warmthFire * 0.15 : 0);
    s.warmth = clamp(s.warmth - drain * dt);
  }

  let damage = 0;
  if (s.hunger <= 0) damage += RATES.starvationDamage;
  if (s.thirst <= 0) damage += RATES.dehydrationDamage;
  if (s.warmth <= 0) damage += RATES.coldDamage;
  if (s.energy <= 0) damage += RATES.exhaustionDamage;

  if (damage > 0) {
    s.health = clamp(s.health - damage * dt);
  } else if (s.hunger > 40 && s.thirst > 40 && s.warmth > 30) {
    s.health = clamp(s.health + RATES.regen * dt);
  }
  return s;
}

export function isDead(stats: Stats): boolean {
  return stats.health <= 0;
}

// ---------------------------------------------------------------- Inventory

export type ItemId =
  | 'wood'
  | 'stone'
  | 'fiber'
  | 'berries'
  | 'mushroom'
  | 'water'
  | 'axe'
  | 'campfire'
  | 'shelter'
  | 'torch'
  | 'fish';

export const ITEM_LABELS: Record<ItemId, string> = {
  wood: 'Madera',
  stone: 'Piedra',
  fiber: 'Fibra',
  berries: 'Bayas',
  mushroom: 'Seta',
  water: 'Agua',
  axe: 'Hacha',
  campfire: 'Fogata',
  shelter: 'Refugio',
  torch: 'Antorcha',
  fish: 'Pescado',
};

export type Inventory = Partial<Record<ItemId, number>>;

export function count(inv: Inventory, id: ItemId): number {
  return inv[id] ?? 0;
}

export function add(inv: Inventory, id: ItemId, n = 1): Inventory {
  return { ...inv, [id]: count(inv, id) + n };
}

export function remove(inv: Inventory, id: ItemId, n = 1): Inventory | null {
  if (count(inv, id) < n) return null;
  const next = { ...inv, [id]: count(inv, id) - n };
  if (next[id] === 0) delete next[id];
  return next;
}

// ---------------------------------------------------------------- Crafting

export interface Recipe {
  id: ItemId;
  label: string;
  cost: Partial<Record<ItemId, number>>;
  placeable: boolean;
}

export const RECIPES: Recipe[] = [
  { id: 'axe', label: 'Hacha (más madera por árbol)', cost: { wood: 2, stone: 2, fiber: 1 }, placeable: false },
  { id: 'torch', label: 'Antorcha (luz de noche)', cost: { wood: 1, fiber: 2 }, placeable: false },
  { id: 'campfire', label: 'Fogata (calor)', cost: { wood: 5, stone: 3 }, placeable: true },
  { id: 'shelter', label: 'Refugio (protege del frío)', cost: { wood: 8, fiber: 4 }, placeable: true },
];

export function canCraft(inv: Inventory, recipe: Recipe): boolean {
  return Object.entries(recipe.cost).every(([id, n]) => count(inv, id as ItemId) >= (n ?? 0));
}

export function craft(inv: Inventory, recipe: Recipe): Inventory | null {
  if (!canCraft(inv, recipe)) return null;
  let next: Inventory = inv;
  for (const [id, n] of Object.entries(recipe.cost)) {
    const r = remove(next, id as ItemId, n ?? 0);
    if (!r) return null;
    next = r;
  }
  return add(next, recipe.id, 1);
}

// ---------------------------------------------------------------- Consumables

export interface ConsumeEffect {
  hunger?: number;
  thirst?: number;
  health?: number;
  energy?: number;
}

export const CONSUMABLES: Partial<Record<ItemId, ConsumeEffect>> = {
  berries: { hunger: 18, thirst: 4 },
  mushroom: { hunger: 30, health: -5 },
  water: { thirst: 45 },
  fish: { hunger: 45, energy: 10 },
};

export function consume(stats: Stats, inv: Inventory, id: ItemId): { stats: Stats; inv: Inventory } | null {
  const effect = CONSUMABLES[id];
  if (!effect) return null;
  const nextInv = remove(inv, id, 1);
  if (!nextInv) return null;
  const s = { ...stats };
  s.hunger = clamp(s.hunger + (effect.hunger ?? 0));
  s.thirst = clamp(s.thirst + (effect.thirst ?? 0));
  s.health = clamp(s.health + (effect.health ?? 0));
  s.energy = clamp(s.energy + (effect.energy ?? 0));
  return { stats: s, inv: nextInv };
}

// ---------------------------------------------------------------- Score

export function scoreFor(secondsSurvived: number, discovered: number, crafted: number, escaped = false, relics = 0): number {
  return Math.round(secondsSurvived * 2 + discovered * 150 + crafted * 100 + relics * 80 + (escaped ? 2000 : 0));
}
