/** Progresión P4-A: Savia (XP) and Rango 1–8. Ranks give no combat power (spec #4 §2). */
export const PROGRESS = {
  ranks: [0, 80, 220, 420, 680, 980, 1300, 1650],
  shrine: 30,
  chest: 10,
  mount: 40,
  power: 60,
  /** The dungeon boss each altar implies (granted with the power, never live). */
  boss: 50,
  upgrade: 10,
  ending: 150,
  zone: 15,
  pillar: 40,
  raid: 15,
  lieut: 50,
  whale: 40,
  /** Metres: who counts as "there" for a lieutenant, a pillar. */
  near: 40,
  kill: { wolf: 1, brute: 3, rayo: 2 } as Record<string, number>,
  /** Kill Savia per game day. */
  killCap: 40,
} as const;

/** What milestoneXp reads (a SavedPlayer fits). */
export interface ProgressSource {
  shrines?: number[];
  chests?: number[];
  steed?: unknown;
  fish?: unknown;
  frog?: unknown;
  dragon?: unknown;
  star?: boolean;
  enredadera?: boolean;
  viento?: boolean;
  fuego?: boolean;
  piedra?: boolean;
  weaponLvl?: number;
  capaLvl?: number;
  ending?: boolean;
  xp?: number;
}

export function rankOf(xp: number): number {
  let r = 1;
  for (let i = 1; i < PROGRESS.ranks.length; i++) if (xp >= PROGRESS.ranks[i]!) r = i + 1;
  return r;
}

export const pointsOf = (rank: number): number => Math.max(0, rank - 1);

/** Savia needed for the next Rango, or null at the top. */
export function nextRankXp(rank: number): number | null {
  return PROGRESS.ranks[rank] ?? null;
}

/** Savia the save already proves (retroactive): old saves land on the right Rango. `ending` = El Marchito fell with this player in the world. */
export function milestoneXp(p: ProgressSource): number {
  const mounts = [p.steed, p.fish, p.frog, p.dragon].filter(Boolean).length + (p.star ? 1 : 0);
  const powers = [p.enredadera, p.viento, p.fuego, p.piedra].filter(Boolean).length;
  return (
    (p.shrines?.length ?? 0) * PROGRESS.shrine +
    (p.chests?.length ?? 0) * PROGRESS.chest +
    mounts * PROGRESS.mount +
    powers * (PROGRESS.power + PROGRESS.boss) +
    ((p.weaponLvl ?? 0) + (p.capaLvl ?? 0)) * PROGRESS.upgrade +
    (p.ending ? PROGRESS.ending : 0)
  );
}

export const totalXp = (p: ProgressSource): number => milestoneXp(p) + (p.xp ?? 0);

export const killXp = (kind: string): number => PROGRESS.kill[kind] ?? 0;

/** Kill Savia under the daily cap. */
export function addKillXp(killDay: { day: number; xp: number } | undefined, day: number, kind: string): { killDay: { day: number; xp: number }; gain: number } {
  const cur = killDay && killDay.day === day ? killDay.xp : 0;
  const gain = Math.max(0, Math.min(killXp(kind), PROGRESS.killCap - cur));
  return { killDay: { day, xp: cur + gain }, gain };
}
