/** Progresión P4-A: Savia (XP) and Rango 1–8. Ranks give no combat power (spec #4 §2). */
import { NAMES } from './names';
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

// ---------------------------------------------------------------- P4-B: Oficios

export type SkillId = 'pies' | 'planeo' | 'pulmon' | 'trepador' | 'mano' | 'fogatero' | 'trampero' | 'ojo' | 'amiga' | 'silbido' | 'mochila' | 'pastor';

/** Three branches of four, bought in order within a branch (Andar, Oficio, Compañía). */
export const BRANCHES: readonly { name: string; skills: readonly SkillId[] }[] = [
  { name: NAMES.branches[0], skills: ['pies', 'planeo', 'pulmon', 'trepador'] },
  { name: NAMES.branches[1], skills: ['mano', 'fogatero', 'trampero', 'ojo'] },
  { name: NAMES.branches[2], skills: ['amiga', 'silbido', 'mochila', 'pastor'] },
];

export const SKILL_IDS: readonly SkillId[] = BRANCHES.flatMap((b) => b.skills);

/** The multipliers each oficio applies in its site (spec §4, adapted to the real mechanics: see the P4-B plan). */
export const SKILL_FX = {
  /** Pies ligeros: stamina comes back faster. */
  regen: 1.25,
  /** Planeo largo: GLIDE.sink ×. */
  sink: 0.8,
  /** Pulmón: fast swimming spends ×. */
  swimFast: 0.5,
  /** Trepador: climbing spends ×; wet rock climbs at × speed. */
  climb: 0.75,
  wetClimb: 0.5,
  /** Mano buena: +N wood/stone/berries per harvest. */
  harvest: 1,
  /** Fogatero: fogata channel seconds. */
  channel: 2,
  /** Trampero: spikes/roots hp ×. */
  trap: 1.3,
  /** Buen ojo: amber/quartz regrow days. */
  regrowDays: 1,
  /** Mano amiga: revive reach ×. */
  reviveReach: 2,
  /** Mochila honda: grave pickup radius (m). */
  gravePickup: 10,
  /** Pastor: land mount speed ×. */
  mount: 1.1,
  /** Bayas to forget every oficio at the Heart. */
  forgetCost: 5,
} as const;

/** One dry line per oficio (the Oficios screen). */
export const SKILL_LINES: Record<SkillId, string> = {
  pies: 'El aliento vuelve un 25 % más rápido.',
  planeo: 'Planeando caes un 20 % más despacio.',
  pulmon: 'Nadar rápido gasta la mitad de aliento.',
  trepador: 'Trepar gasta un 25 % menos. Con lluvia se trepa, despacio.',
  mano: 'Madera, piedra y bayas: una más cada vez.',
  fogatero: 'Viajar por las fogatas tarda 2 s, no 5.',
  trampero: 'Tus estacas y tus redes aguantan un 30 % más.',
  ojo: 'El ámbar y el cuarzo te vuelven en 1 día, no en 2.',
  amiga: 'Levantas a un amigo desde el doble de lejos.',
  silbido: 'Llamas a tus monturas desde cualquier fogata encendida.',
  mochila: 'Tu tumba vuelve a ti desde 10 m.',
  pastor: 'Tu ciervo y tu rana corren un 10 % más.',
};

export const isSkill = (id: unknown): id is SkillId => typeof id === 'string' && (SKILL_IDS as readonly string[]).includes(id);

export const hasSkill = (p: { skills?: readonly string[] } | undefined, id: SkillId): boolean => !!p?.skills?.includes(id);

/** Oficio points still free at this Rango. */
export const skillPoints = (rank: number, skills: readonly string[] = []): number => Math.max(0, pointsOf(rank) - skills.length);

export function canLearn(skills: readonly string[], id: SkillId, rank: number): 'ok' | 'owned' | 'order' | 'points' {
  if (skills.includes(id)) return 'owned';
  const branch = BRANCHES.find((b) => b.skills.includes(id))!;
  const i = branch.skills.indexOf(id);
  if (i > 0 && !skills.includes(branch.skills[i - 1]!)) return 'order';
  return skillPoints(rank, skills) > 0 ? 'ok' : 'points';
}
