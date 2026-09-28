import { CORRUPT_LANDS, corruptFeatures } from './terrain';

/**
 * Los 4 Pilares-raíz (spec S5 §5): the tower's shields, one per power, each reached with a different mount.
 * 0 Enredadera in a thorn thicket (root bridges), 1 Viento under el Lago Negro (fish dive to the anchor, then
 * gusts on the shore), 2 Fuego in la Carrera de ceniza (the deer; Llamaradas on the cocoon), 3 Piedra on top of
 * los Escalones rotos (frog or dragon; a pillar on the plate lifts the lid). Every core: A held 3 s.
 */
export const PILLAR = { count: 4, idBase: 930_000, hold: 3, reach: 2.5, powers: ['enredadera', 'viento', 'fuego', 'piedra'] } as const;
/** The Enredadera pillar's thicket: 10 PV/s in the ring, a 3 m clearing round the core, 3 bare roots on its edge. */
export const THICKET = { r: 15, clear: 3, rootReach: 3, bridge: 1.2, dps: 10, x: -15, d: 115 } as const;
/** The Viento pillar: the anchor on the lake bed (hit only diving), the core on the east shore under 3 gusts of miasma. */
export const LAKE_PILLAR = { anchorHp: 150, gustMult: 3, dive: 4, miasma: 3, shore: 4 } as const;
/** The Fuego pillar: hot ash (a disc) that hurts on foot, 3 Llamaradas on the cocoon, 3 rayo guards. */
export const ASH_RUN = { r: 35, dps: 4, guards: 3, burns: 3, x: 45, d: 105 } as const;
/** The Piedra pillar: core on the top terrace (d0 + top), its plate `plateOff` m west. */
export const LID = { plateOff: 3, plateR: 1.2, pillarR: 1.5, top: 34 } as const;

export interface Spot {
  x: number;
  z: number;
}
export interface PillarSites {
  /** Cores 0–3 (0 Enredadera, 1 Viento on the shore, 2 Fuego, 3 Piedra). */
  cores: Spot[];
  /** The Enredadera thicket's 3 bare roots. */
  roots: Spot[];
  /** The Viento anchor on the lake's bed (its centre). */
  anchor: Spot;
  /** The Piedra plate. */
  plate: Spot;
}

const zAt = (d: number) => CORRUPT_LANDS.z1 - d;

export function pillarSites(seed: number): PillarSites {
  const { lake, steps } = corruptFeatures(seed);
  const vine = { x: THICKET.x, z: zAt(THICKET.d) };
  const stone = { x: steps.x, z: zAt(steps.d0 + LID.top) };
  return {
    cores: [vine, { x: lake.x + lake.r + LAKE_PILLAR.shore, z: lake.z }, { x: ASH_RUN.x, z: zAt(ASH_RUN.d) }, stone],
    roots: [0, 1, 2].map((k) => ({ x: vine.x + Math.sin((k * 2 * Math.PI) / 3) * THICKET.r, z: vine.z + Math.cos((k * 2 * Math.PI) / 3) * THICKET.r })),
    anchor: { x: lake.x, z: lake.z },
    plate: { x: stone.x - LID.plateOff, z: stone.z },
  };
}

function segDist(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** In the thicket's thorns: inside its ring, not in the clearing, not on a root bridge already made. */
export function thicketHurts(s: PillarSites, bridged: readonly boolean[], x: number, z: number): boolean {
  const c = s.cores[0]!;
  const d = Math.hypot(x - c.x, z - c.z);
  if (d > THICKET.r || d < THICKET.clear) return false;
  return !s.roots.some((r, k) => bridged[k] && segDist({ x, z }, r, c) <= THICKET.bridge);
}

/** On la Carrera's hot ash. */
export function ashHurts(s: PillarSites, x: number, z: number): boolean {
  const c = s.cores[2]!;
  return Math.hypot(x - c.x, z - c.z) <= ASH_RUN.r;
}

/** The Piedra lid is up: a stone pillar on the plate, or somebody else standing on it. */
export function lidUp(s: PillarSites, pillars: readonly Spot[], others: readonly Spot[]): boolean {
  const on = (o: Spot, r: number) => Math.hypot(o.x - s.plate.x, o.z - s.plate.z) <= r;
  return pillars.some((o) => on(o, LID.pillarR)) || others.some((o) => on(o, LID.plateR));
}
