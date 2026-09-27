import { DUNGEON, inDungeon, leverPos } from '../shared/dungeon';
import type { DungeonView, MarchitoView } from '../shared/protocol';

/** The contextual A / E action around the Raíz-madre, if any. The server re-checks everything. */
export function dungeonAction(
  pos: { x: number; y: number; z: number },
  entrance: { x: number; z: number },
  view: DungeonView,
  power: boolean,
): { act: number; label: string } | null {
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  if (!inDungeon(pos.x, pos.z)) {
    return near(entrance.x, entrance.z, DUNGEON.trunkR + DUNGEON.enterReach) ? { act: 0, label: 'Entrar en la Raíz-madre' } : null;
  }
  if (near(DUNGEON.x, DUNGEON.entryZ, DUNGEON.exitReach)) return { act: 1, label: 'Salir de la Raíz-madre' };
  if (!view.gate) {
    for (const i of [0, 1]) {
      const l = leverPos(i);
      if (near(l.x, l.z, DUNGEON.leverReach)) return { act: 2 + i, label: 'Tirar de la raíz' };
    }
  }
  if (view.gate && !power && near(DUNGEON.x, DUNGEON.altarZ, DUNGEON.altarReach)) return { act: 4, label: 'Tomar la Enredadera' };
  return null;
}

/** El Marchito's bar while he is in the base. */
export function marchitoBarText(v: MarchitoView | null): string | null {
  if (!v) return null;
  return v.laughing ? 'El Marchito se ríe' : `El Marchito · voluntad ${v.will}/${v.max}`;
}

export function bossBarText(view: DungeonView): string | null {
  const b = view.boss;
  return b ? `Tragón de Papel ${b.hp}/${b.max} · ${b.weak ? '¡expuesto!' : 'doblado'}` : null;
}
