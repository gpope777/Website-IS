import type { BookView } from '../shared/protocol';
import { capaMult, weaponMult } from '../shared/items';
import { NAMES } from '../shared/names';
import { FEATS, nextRankXp, PROGRESS } from '../shared/progression';
import { staminaFor } from './movement';

/** P4-D: what the Libro reads (all from the own snapshot). */
export interface BookData {
  xp: number;
  rank: number;
  weapon: number;
  capa: number;
  shrines: number;
  chests: number;
  powers: { enredadera: boolean; viento: boolean; fuego: boolean; piedra: boolean };
  mounts: { steed: boolean; star: boolean; fish: boolean; frog: boolean; dragon: boolean };
  book: BookView;
}

const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const tag = (on: boolean, text: string) => `<span class="${on ? 'on' : 'off'}">${text}</span>`;

/** The Libro (Menú): one scrolling page, text and icons; Oficios and Aspecto at the bottom. */
export function bookHtml(d: BookData): string {
  const next = nextRankXp(d.rank);
  const from = PROGRESS.ranks[d.rank - 1] ?? 0;
  const pct = next === null ? 100 : Math.max(0, Math.min(100, Math.round(((d.xp - from) / (next - from)) * 100)));
  const b = d.book;
  const powers = [
    tag(d.powers.enredadera, `🌿 ${NAMES.powerVine}`),
    tag(d.powers.viento, `🌬️ ${NAMES.powerWind}`),
    tag(d.powers.fuego, `🔥 ${NAMES.powerFire}`),
    tag(d.powers.piedra, `🪨 ${NAMES.powerStone}`),
  ].join(' ');
  const mounts = [
    tag(d.mounts.steed && !d.mounts.star, `🦌 ${NAMES.deer}`),
    tag(d.mounts.fish, `🐟 ${NAMES.fish}`),
    tag(d.mounts.frog, `🐸 ${NAMES.frog}`),
    tag(d.mounts.dragon, `🐉 ${NAMES.dragon}`),
    tag(d.mounts.star, `⭐ ${NAMES.legendary}`),
  ].join(' ');
  const feats = FEATS.map((id) => `<li class="feat${b.feats.includes(id) ? ' done' : ''}">${NAMES.featNames[id - 1]}</li>`).join('');
  return `<h2>${NAMES.book}</h2>
    <p>${NAMES.rank} ${d.rank} · ${next === null ? d.xp : `${d.xp} / ${next}`} ${NAMES.xp}</p>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <p>Arma +${d.weapon} (×${num(weaponMult(d.weapon))}) · Capa ${d.capa} (−${Math.round((1 - capaMult(d.capa)) * 100)} %) · Aliento ${staminaFor(d.shrines)}</p>
    <p class="tags">${powers}</p>
    <p class="tags">${mounts}</p>
    <p>Santuarios ${d.shrines}/${b.shrinesMax} · Cofres ${d.chests}/${b.chestsMax} · Jefes ${b.bosses}/11 · Zonas limpias ${b.zones}/${b.zonesMax} · Día ${b.day}</p>
    <p>Lobos ${b.kills.wolf} · Brutos ${b.kills.brute} · Rayos ${b.kills.rayo} · Asedios aguantados ${b.raids}</p>
    <h3>${NAMES.feats}</h3>
    <ul class="feats">${feats}</ul>
    <button class="secondary" data-a="skills">${NAMES.skills}</button>
    <button class="secondary" data-a="look">${NAMES.look}</button>
    <button class="secondary" data-a="back">Volver</button>`;
}
