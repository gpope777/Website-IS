import { createRng } from './rng';
import { depthAt } from './coast';
import { inBravas } from './fish';
import { COAST, coastFeatures, HALF, inMap, type Terrain } from './terrain';

/** La Ballena: one per world, tamed by two or more (spec §5.2 + Gabriel's decision), 4 seats. */
export const WHALE = {
  /** Metres from the whale to count for (and start) the taming. */
  tameReach: 10,
  /** Metres from the whale to get on. */
  reach: 5,
  /** Never tamed alone. */
  minPlayers: 2,
  seats: 4,
  rounds: [
    { speed: 2.2, width: 1.2 },
    { speed: 3.1, width: 0.95 },
    { speed: 4.0, width: 0.75 },
    { speed: 4.8, width: 0.55 },
  ],
  /** Each extra player in range widens the zone by this, up to `maxExtra` extras. */
  perExtra: 0.4,
  maxExtra: 3,
  /** Seconds it stays under after a failed taming. */
  dive: 10,
  walk: 5,
  run: 7,
  /** Server speed cap for the pilot. */
  maxSpeed: 8,
  /** It can't go where the sea is shallower than this. */
  minDepth: 3,
  /** Seconds of online time with nobody aboard before it swims home. */
  idle: 600,
  /** Riders sit this high above the water. */
  height: 1.2,
  /** Getting off: back on your fish if it waits this close. */
  fishBack: 8,
} as const;

/** Where the wild whale spouts: seeded, deep sea, clear of the aguas bravas and the islets. */
export function wildWhale(t: Terrain, seed: number): { x: number; z: number } {
  const rng = createRng(seed ^ 0xba11e);
  const { island, islets } = coastFeatures(seed);
  const best = { x: 0, z: HALF + COAST.deepFrom + 10 };
  for (let tries = 0; tries < 400; tries++) {
    const c = { x: (rng() - 0.5) * (2 * HALF - 80), z: HALF + COAST.deepFrom + rng() * 60 };
    if (depthAt(t, c.x, c.z) < 8 || inBravas(island, c.x, c.z) || islets.some((i) => Math.hypot(i.x - c.x, i.z - c.z) < i.r + 15)) continue;
    return c;
  }
  // ponytail: the deep sea is 60 m × 400 m; 400 tries always found a spot in tests.
  return best;
}

/** Can the whale be here? In the map with at least 3 m of water. Aguas bravas are fine. */
export function whaleStepOk(t: Terrain, x: number, z: number): boolean {
  return inMap(x, z, 2) && depthAt(t, x, z) >= WHALE.minDepth;
}

export function whaleWidth(base: number, players: number): number {
  return base * (1 + WHALE.perExtra * Math.min(WHALE.maxExtra, Math.max(0, players - 1)));
}

export const canTame = (players: number): boolean => players >= WHALE.minPlayers;

const SEATS = [
  { x: 0, z: 1.6 },
  { x: -0.8, z: 0 },
  { x: 0.8, z: 0 },
  { x: 0, z: -1.6 },
] as const;

/** Seat position relative to the whale (0 = pilot, at the front), turned by its yaw. */
export function seatOffset(seat: number, yaw: number): { x: number; z: number } {
  const s = SEATS[seat] ?? SEATS[0];
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  return { x: s.x * c + s.z * n, z: -s.x * n + s.z * c };
}
