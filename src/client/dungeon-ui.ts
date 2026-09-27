import { NAMES } from '../shared/names';
import { DUNGEON, inDungeon, inside, leverPos } from '../shared/dungeon';
import type { CarryView, DungeonView, MarchitoView } from '../shared/protocol';

/** Before the first snapshot: everything shut, the block and lantern where they start. */
export function emptyDungeonView(): DungeonView {
  return {
    gate: false, gates: [false, false, false, false, false], levers: [false, false], purified: false, boss: null, plate: false,
    block: { ...inside(DUNGEON.blockStart), held: null }, lantern: { ...inside(DUNGEON.lantern), held: null }, lit: false, elite: null,
  };
}

/** The contextual A / E action around the Raíz-madre, if any. The server re-checks everything. */
export function dungeonAction(
  pos: { x: number; y: number; z: number },
  entrance: { x: number; z: number },
  view: DungeonView,
  power: boolean,
  /** Your name: what you carry is yours to drop. */
  me = '',
): { act: number; label: string } | null {
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  if (!inDungeon(pos.x, pos.z)) {
    return near(entrance.x, entrance.z, DUNGEON.trunkR + DUNGEON.enterReach) ? { act: 0, label: `Entrar en la ${NAMES.forestRoot}` } : null;
  }
  if (near(DUNGEON.x, DUNGEON.entryZ, DUNGEON.exitReach)) return { act: 1, label: `Salir de la ${NAMES.forestRoot}` };
  if (!view.gate) {
    for (const i of [0, 1]) {
      const l = leverPos(i);
      if (near(l.x, l.z, DUNGEON.leverReach)) return { act: 2 + i, label: 'Tirar de la raíz' };
    }
  }
  if (view.gate && !power && near(DUNGEON.x, DUNGEON.altarZ, DUNGEON.altarReach)) return { act: 4, label: `Tomar la ${NAMES.powerVine}` };
  const mine = (c: CarryView) => me !== '' && c.held === me;
  const br = inside(DUNGEON.brazier);
  if (!view.lit && mine(view.lantern) && near(br.x, br.z, DUNGEON.carryReach)) return { act: 7, label: 'Encender el brasero' };
  if (mine(view.lantern)) return { act: 6, label: 'Soltar la linterna' };
  if (mine(view.block)) return { act: 5, label: 'Soltar el bloque' };
  if (!view.block.held && near(view.block.x, view.block.z, DUNGEON.carryReach)) return { act: 5, label: 'Coger el bloque' };
  if (!view.lit && !view.lantern.held && near(view.lantern.x, view.lantern.z, DUNGEON.carryReach)) return { act: 6, label: 'Coger la linterna' };
  return null;
}

/** The mini-boss's bar while it fights. */
export function eliteBarText(view: DungeonView): string | null {
  const e = view.elite;
  return e ? `Bruto reforzado ${e.hp}/${e.max}${e.charging ? ' · ¡carga!' : ''}` : null;
}

/** El Marchito's bar while he is in the base. */
export function marchitoBarText(v: MarchitoView | null): string | null {
  if (!v) return null;
  return v.laughing ? `${NAMES.villain} se ríe` : `${NAMES.villain} · voluntad ${v.will}/${v.max}`;
}

export function bossBarText(view: DungeonView): string | null {
  const b = view.boss;
  return b ? `${NAMES.bossForest} ${b.hp}/${b.max} · ${b.weak ? '¡expuesto!' : 'doblado'}` : null;
}
