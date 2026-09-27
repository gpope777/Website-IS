import type { WolfAnim } from '../protocol';
import type { Wolf } from './wolves';

/**
 * The white allies in the tower (spec S5 §11.2): each purified boss helps on its floor. They cannot be hurt.
 * They follow the nearest player on their floor; the Tragón bites a beast near you, the Antenón blows one
 * off the ledge, the Zancudo only carries its farol (the light), the Cucurucho stones one from afar.
 */
export const TOWER_ALLY = {
  follow: 2.5,
  run: 5.5,
  /** A beast this close to a player is fair game for the Tragón and the Antenón. */
  reach: 4,
  tragon: { damage: 25, every: 1.2 },
  antenon: { every: 5, reach: 6 },
  cucurucho: { damage: 30, every: 6, range: 15 },
} as const;

export type TowerAllyKind = 'tragon' | 'antenon' | 'zancudo' | 'cucurucho';
export const TOWER_ALLY_KINDS: readonly TowerAllyKind[] = ['tragon', 'antenon', 'zancudo', 'cucurucho'];

export interface TowerAlly {
  kind: TowerAllyKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  cooldown: number;
  anim: WolfAnim;
}

export function createTowerAlly(kind: TowerAllyKind, at: { x: number; z: number }, y: number): TowerAlly {
  return { kind, x: at.x, y, z: at.z, yaw: 0, cooldown: 0, anim: 'idle' };
}

/** One tick: follow the nearest player, then help. Returns the beast hit and how hard (the caller deals it). */
export function stepTowerAlly(a: TowerAlly, players: readonly { x: number; z: number }[], foes: readonly Wolf[], dt: number): { foe: Wolf; damage: number } | null {
  a.cooldown = Math.max(0, a.cooldown - dt);
  let lead: { x: number; z: number } | null = null;
  let bd = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - a.x, p.z - a.z);
    if (d < bd) [bd, lead] = [d, p];
  }
  a.anim = 'idle';
  if (lead && bd > TOWER_ALLY.follow) {
    const step = Math.min(bd - TOWER_ALLY.follow, TOWER_ALLY.run * dt);
    a.x += ((lead.x - a.x) / bd) * step;
    a.z += ((lead.z - a.z) / bd) * step;
    a.yaw = Math.atan2(lead.x - a.x, lead.z - a.z);
    a.anim = 'run';
  }
  if (a.kind === 'zancudo' || a.cooldown > 0) return null;
  const alive = foes.filter((w) => w.hp > 0);
  const nearYou = (w: Wolf, r: number) => players.some((p) => Math.hypot(w.x - p.x, w.z - p.z) <= r);
  let foe: Wolf | undefined;
  let damage = 0;
  if (a.kind === 'tragon') {
    foe = alive.find((w) => nearYou(w, TOWER_ALLY.reach));
    damage = TOWER_ALLY.tragon.damage;
    a.cooldown = foe ? TOWER_ALLY.tragon.every : 0;
  } else if (a.kind === 'antenon') {
    foe = alive.find((w) => nearYou(w, TOWER_ALLY.antenon.reach));
    damage = foe ? foe.hp : 0;
    a.cooldown = foe ? TOWER_ALLY.antenon.every : 0;
  } else {
    foe = alive.filter((w) => Math.hypot(w.x - a.x, w.z - a.z) <= TOWER_ALLY.cucurucho.range).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    damage = TOWER_ALLY.cucurucho.damage;
    a.cooldown = foe ? TOWER_ALLY.cucurucho.every : 0;
  }
  if (!foe) return null;
  a.anim = 'attack';
  a.yaw = Math.atan2(foe.x - a.x, foe.z - a.z);
  return { foe, damage };
}
