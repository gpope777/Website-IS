import type { ClipDef } from './actor';
import type { Body } from './hero-palette';
export type { Body } from './hero-palette';

export const BODIES: readonly Body[] = ['caballero', 'barbaro', 'maga', 'picaro'];

/** Spec §1.1: game anim → KayKit clip. */
export const HERO_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Idle' },
  walk: { clip: 'Walking_A' },
  run: { clip: 'Running_A' },
  jump: { clip: 'Jump_Full_Short', once: true },
  land: { clip: 'Jump_Land', once: true },
  swim: { clip: 'Walking_B', speed: 0.5 },
  attack: { clip: '1H_Melee_Attack_Chop', once: true },
  attack1: { clip: '1H_Melee_Attack_Chop', once: true },
  attack2: { clip: '1H_Melee_Attack_Slice_Horizontal', once: true },
  attack3: { clip: '1H_Melee_Attack_Slice_Diagonal', once: true },
  spin: { clip: '2H_Melee_Attack_Spin', once: true },
  roll: { clip: 'Dodge_Forward', once: true },
  block: { clip: 'Blocking' },
  blockHit: { clip: 'Block_Hit', once: true },
  parry: { clip: 'Block_Attack', once: true },
  bow: { clip: '1H_Ranged_Shoot', once: true },
  cast: { clip: 'Spellcast_Shoot', once: true },
  hurt: { clip: 'Hit_A', once: true },
  climb: { clip: 'Walking_B', speed: 0.5 },
  glide: { clip: 'Jump_Idle' },
  slide: { clip: 'Jump_Idle' },
  seat: { clip: 'Sit_Chair_Idle' },
  cheer: { clip: 'Cheer', once: true },
  dead: { clip: 'Death_A', once: true },
};

const WEAPON: Record<Body, string> = { caballero: '1H_Sword', barbaro: '1H_Axe', maga: '1H_Wand', picaro: 'Knife' };
const SHIELD: Partial<Record<Body, string>> = { caballero: 'Round_Shield', barbaro: 'Barbarian_Round_Shield' };
const OWN_HAT = /_(Helmet|Hat)$/;
const PROPS = /^(1H_|2H_|Badge_|Rectangle_|Round_|Spike_|Barbarian_Round_|Mug|Spellbook|Knife|Throwable)/;

/** Spec §1: body + one 1-hand weapon + (knight/barbarian) a round shield; a worn hat hides the body's own. */
export function partVisible(body: Body, mesh: string, hat: number): boolean {
  if (OWN_HAT.test(mesh)) return hat === 0;
  if (PROPS.test(mesh)) return mesh === WEAPON[body] || mesh === SHIELD[body];
  return true;
}
