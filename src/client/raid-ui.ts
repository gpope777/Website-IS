import type { RaidView } from '../shared/protocol';

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

/** Screen arrow toward the raid origin. Camera forward is angle yaw + π in the x=sin/z=cos convention; screen-right is forward − π/2. */
export function raidArrow(dir: number, camYaw: number): string {
  const rel = dir - (camYaw + Math.PI);
  const k = Math.round(-rel / (Math.PI / 4));
  return ARROWS[((k % 8) + 8) % 8]!;
}

export function raidText(raid: RaidView | null, camYaw: number): string | null {
  if (!raid) return null;
  const arrow = raidArrow(raid.dir, camYaw);
  return raid.phase === 'warn' ? `${arrow} Se acerca un asedio` : `${arrow} ¡Asedio! Nivel ${raid.level}`;
}
