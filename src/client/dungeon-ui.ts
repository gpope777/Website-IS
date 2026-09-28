import { NAMES } from '../shared/names';
import { DUNGEON, inDungeon, inside, leverPos } from '../shared/dungeon';
import { COAST_DUNGEON, inCoastDungeon, insideCoast } from '../shared/coast-dungeon';
import { inSwampDungeon, insideSwamp, SWAMP_DUNGEON } from '../shared/swamp-dungeon';
import { dungeonBlockCell, inMountainDungeon, insideMountain, MOUNTAIN_DUNGEON } from '../shared/mountain-dungeon';
import { AIR } from '../shared/dragon';
import { inTowerDungeon, TOWER_DUNGEON } from '../shared/tower-dungeon';
import { FINAL } from '../shared/sim/marchito-final';
import type { CarryView, CoastDungeonView, DungeonView, FinalView, MarchitoView, MountainDungeonView, SwampDungeonView, TowerDungeonView } from '../shared/protocol';

/** Before the first snapshot: everything shut, the block and lantern where they start. */
export function emptyDungeonView(): DungeonView {
  return {
    gate: false, gates: [false, false, false, false, false], levers: [false, false], purified: false, boss: null, plate: false,
    block: { ...inside(DUNGEON.blockStart), held: null }, lantern: { ...inside(DUNGEON.lantern), held: null }, lit: false, elite: null,
    coast: { gates: [false, false, false, false], levers: [false, false], block: insideCoast(COAST_DUNGEON.blockStart), plate: false, elite: null, boss: null },
    swamp: { gates: [false, false, false, false], levers: [false, false], thorn: 0, lamps: [false, false, false], planks: Array.from({ length: SWAMP_DUNGEON.planks }, () => true), elite: null, boss: null, vents: [false, false, false, false] },
    mountain: { gates: [false, false, false, false], levers: [false, false], plate: false, blocks: MOUNTAIN_DUNGEON.blocks.starts.map((c) => dungeonBlockCell(c)), elite: null, boss: null },
    tower: { gates: [false, false, false, false, false], bridges: [false, false], vents: [false, false, false], braziers: [false, false, false, false], plate: false, flecha: null, allies: [], final: null },
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
  if (v.laughing) return `${NAMES.villain} se ríe`;
  if (v.channel !== undefined) return `${NAMES.villain} envuelve el ${NAMES.heart} · ${Math.round(v.channel * 100)} % · voluntad ${v.will}/${v.max}`;
  if (v.grab) return `${NAMES.villain} envuelve al ${NAMES.bossForestShort} · ${Math.round(v.grab * 100)} % · voluntad ${v.will}/${v.max}`;
  return `${NAMES.villain} · voluntad ${v.will}/${v.max}`;
}

/** S5-D: riding the dragon, the claw's target: the nearest rayo within AIR.reach in 3D, or null. */
export function clawPick(rider: { x: number; y: number; z: number }, foes: readonly { id: number; kind: string; x: number; y: number; z: number }[]): number | null {
  let best: number | null = null;
  let bd: number = AIR.reach;
  for (const f of foes) {
    if (f.kind !== 'rayo') continue;
    const d = Math.hypot(f.x - rider.x, f.y - rider.y, f.z - rider.z);
    if (d <= bd) {
      bd = d;
      best = f.id;
    }
  }
  return best;
}

export function bossBarText(view: DungeonView): string | null {
  const b = view.boss;
  return b ? `${NAMES.bossForest} ${b.hp}/${b.max} · ${b.weak ? '¡expuesto!' : 'doblado'}` : null;
}

/** The contextual A / E action around the coast Raíz-madre (acts 8–12). The server re-checks everything. */
export function coastDungeonAction(pos: { x: number; z: number }, entrance: { x: number; z: number }, view: CoastDungeonView, viento: boolean): { act: number; label: string } | null {
  const C = COAST_DUNGEON;
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  if (!inCoastDungeon(pos.x, pos.z)) return near(entrance.x, entrance.z, C.trunkR + C.enterReach) ? { act: 8, label: `Entrar en la ${NAMES.coastRoot}` } : null;
  if (near(C.x, C.entryZ, C.exitReach)) return { act: 9, label: `Salir de la ${NAMES.coastRoot}` };
  if (!view.gates[0]) {
    for (const i of [0, 1]) {
      const l = insideCoast(C.levers[i]!);
      if (near(l.x, l.z, C.leverReach)) return { act: 10 + i, label: 'Tirar de la raíz' };
    }
  }
  if (view.gates[0] && !viento && near(C.x, C.altarZ, C.altarReach)) return { act: 12, label: `Tomar el ${NAMES.powerWind}` };
  return null;
}

/** The bruto escudado's bar while it fights. */
export function shieldBarText(view: CoastDungeonView): string | null {
  const e = view.elite;
  if (!e) return null;
  const name = NAMES.eliteCoast.charAt(0).toUpperCase() + NAMES.eliteCoast.slice(1);
  return `${name} ${e.hp}/${e.max} · ${e.exposed ? '¡expuesto!' : e.charging ? '¡carga!' : 'escudo'}`;
}

/** El Antenón's bar while it fights, with its wind-up called out. */
export function antenonBarText(view: CoastDungeonView): string | null {
  const b = view.boss;
  if (!b) return null;
  const state = b.tell === 'sweep' ? '¡barrido!' : b.tell === 'charge' ? '¡carga!' : b.exposed ? '¡expuesto!' : 'cáscara';
  return `${NAMES.bossCoast} ${b.hp}/${b.max} · ${state}`;
}

/** El Zancudo's bar while it fights: out of reach, diving, on the floor, or clinging to someone. */
export function zancudoBarText(view: SwampDungeonView): string | null {
  const b = view.boss;
  if (!b) return null;
  const state = b.grounded ? '¡en el suelo!' : b.latch ? `chupando a ${b.latch}: ¡rueda!` : b.diving ? '¡picado!' : 'en el aire';
  return `${NAMES.bossSwamp} ${b.hp}/${b.max} · ${state}`;
}

export function cucuruchoBarText(view: MountainDungeonView): string | null {
  const b = view.boss;
  if (!b) return null;
  const state = b.stuck ? ' · ¡gorro clavado!' : b.windup || b.charging ? ' · ¡embiste!' : b.alud.length ? ' · ¡alud!' : '';
  return `${NAMES.bossMountain} ${b.hp}/${b.max}${state}`;
}

/** The contextual A / E action around the swamp Raíz-madre (acts 13–17). The server re-checks everything. */
export function swampDungeonAction(pos: { x: number; z: number }, entrance: { x: number; z: number }, view: SwampDungeonView, fuego: boolean): { act: number; label: string } | null {
  const S = SWAMP_DUNGEON;
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  if (!inSwampDungeon(pos.x, pos.z)) return near(entrance.x, entrance.z, S.trunkR + S.enterReach) ? { act: 13, label: `Entrar en la ${NAMES.swampRoot}` } : null;
  if (near(S.x, S.entryZ, S.exitReach)) return { act: 14, label: `Salir de la ${NAMES.swampRoot}` };
  if (!view.gates[0]) {
    for (const i of [0, 1]) {
      const l = insideSwamp(S.levers[i]!);
      if (near(l.x, l.z, S.leverReach)) return { act: 15 + i, label: 'Tirar de la raíz' };
    }
  }
  if (view.gates[0] && !fuego && near(S.x, S.altarZ, S.altarReach)) return { act: 17, label: `Tomar el ${NAMES.powerFire}` };
  return null;
}

/** The bruto de turba's bar while it fights. */
export function peatBarText(view: SwampDungeonView): string | null {
  const e = view.elite;
  if (!e) return null;
  const name = NAMES.eliteSwamp.charAt(0).toUpperCase() + NAMES.eliteSwamp.slice(1);
  return `${name} ${e.hp}/${e.max}${e.burning ? ' · ardiendo' : e.charging ? ' · ¡carga!' : ''}`;
}

/** The contextual A / E action around the mountain cave (acts 18–25). The server re-checks everything. */
export function mountainDungeonAction(pos: { x: number; z: number }, entrance: { x: number; z: number }, view: MountainDungeonView, piedra: boolean): { act: number; label: string } | null {
  const M = MOUNTAIN_DUNGEON;
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  if (!inMountainDungeon(pos.x, pos.z)) return near(entrance.x, entrance.z, M.mouthR + M.enterReach) ? { act: 18, label: 'Entrar en la cueva' } : null;
  if (near(M.x, M.entryZ, M.exitReach)) return { act: 19, label: 'Salir de la cueva' };
  if (!view.gates[0]) {
    for (const i of [0, 1]) {
      const l = insideMountain(M.levers[i]!);
      if (near(l.x, l.z, M.leverReach)) return { act: 20 + i, label: 'Tirar de la raíz' };
    }
  }
  if (view.gates[0] && !piedra && near(M.x, M.altarZ, M.altarReach)) return { act: 22, label: `Tomar la ${NAMES.powerStone}` };
  if (!view.gates[2]) {
    const i = view.blocks.findIndex((b) => near(b.x, b.z, M.pushReach));
    if (i >= 0) return { act: 23 + i, label: piedra ? 'Empujar el bloque' : 'No se mueve' };
    const l = insideMountain(M.resetLever);
    if (near(l.x, l.z, M.leverReach)) return { act: 25, label: 'Tirar de la palanca' };
  }
  return null;
}

/** The bruto de roca's bar while it fights. */
export function rockBarText(view: MountainDungeonView): string | null {
  const e = view.elite;
  if (!e) return null;
  const name = NAMES.eliteMountain.charAt(0).toUpperCase() + NAMES.eliteMountain.slice(1);
  return `${name} ${e.hp}/${e.max}${e.exposed ? ' · expuesto' : e.charging ? ' · ¡carga!' : ''}`;
}

/** The contextual A / E at the tower (acts 26–27): the door (the server says if it is shut) and the way out. Every floor is solved with a power. */
export function towerDungeonAction(pos: { x: number; z: number }, door: { x: number; z: number }, open: boolean, final: FinalView | null = null, ending = false): { act: number; label: string } | null {
  const T = TOWER_DUNGEON;
  const near = (x: number, z: number, r: number) => Math.hypot(x - pos.x, z - pos.z) <= r;
  const name = NAMES.villainTower;
  if (!inTowerDungeon(pos.x, pos.z)) return near(door.x, door.z, T.doorReach) ? { act: 26, label: ending ? `Subir a ${NAMES.treeTower}`.replace("a el ", "al ") : open ? `Entrar en ${name}` : 'La puerta' } : null;
  if (near(T.x, T.entryZ, T.exitReach)) return { act: 27, label: `Salir de ${name}` };
  // S5-F: a brote within reach (act 28; a closed one: the server says what it wants).
  const br = final?.phase === 2 ? final.brotes.find((b) => !b.broken && near(b.x, b.z, FINAL.pullReach)) : undefined;
  if (br) return { act: 28, label: br.open ? 'Arrancar el brote' : 'El brote' };
  return null;
}

/** El Marchito's bar in the Copa (S5-F): the roots, the brotes left, el Corazón Negro. */
export function finalBarText(view: TowerDungeonView): string | null {
  const f = view.final;
  if (!f) return null;
  if (f.phase === 2) return `${NAMES.villain} se hunde · brotes ${f.brotes.filter((b) => b.broken).length}/${f.brotes.length}${f.pull !== null ? ` · tirando ${Math.round(f.pull * 100)} %` : ''}`;
  if (f.phase === 3 && f.core) {
    const name = NAMES.blackHeart.charAt(0).toUpperCase() + NAMES.blackHeart.slice(1);
    return `${name} ${f.core.hp}/${f.core.max}${f.core.stopped ? ' · ¡parado!' : f.core.healing ? ' · ¡se cura!' : ''}`;
  }
  const state = f.stagger ? ' · ¡se tambalea!' : f.bare ? ' · sin raíces' : f.catching ? ' · ¡arde!' : f.green ? ' · raíces verdes' : ' · raíces';
  return `${NAMES.villain} ${f.hp}/${f.max}${state}`;
}

/** La Flecha's bar in the tower: her red line, stuck in a column. */
export function flechaBarText(view: TowerDungeonView): string | null {
  const f = view.flecha;
  if (!f) return null;
  return `${NAMES.lieutenant3} ${f.hp}/${f.max}${f.stuck ? ' · ¡clavada!' : f.aiming ? ' · ¡raya!' : ''}`;
}
