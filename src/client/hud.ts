import { NAMES } from '../shared/names';
import { FOGATA } from '../shared/fogatas';
import { endingSteps, type EndingStep } from './ending-ui';
import type { Inventory } from '../shared/items';
import { bagRows, heartShown, reviveFrac, Toasts, toastText, topLine, vitalLabel } from './hud-model';
import type { ErrorCode } from '../shared/protocol';
import type { Vitals } from '../shared/survival';
import type { NetStatus } from './net';
import { TIER_LABELS, type Tier } from './quality';

const FATAL: Record<ErrorCode, string> = {
  version: 'Hay una versión nueva del juego.',
  pin: 'PIN incorrecto para ese nombre.',
  rate: 'Demasiados intentos. Espera unos minutos.',
  noworld: 'Ese mundo no existe. Revisa el código.',
  full: 'El mundo está lleno.',
  bad: 'Error de conexión.',
  replaced: 'Entraste desde otro dispositivo.',
};

export class Hud {
  readonly root = document.createElement('div');
  private readonly bars: Record<keyof Vitals, HTMLElement> = {} as Record<keyof Vitals, HTMLElement>;
  /** P7-C: the bag lives behind 🎒 (touch) or the Menú; this is what it shows. */
  private bag: { inv: Inventory; weapon: number; capa: number; rank: string } = { inv: {}, weapon: 0, capa: 0, rank: '' };
  private readonly toasts = new Toasts();
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** P7-C: one top-right line (jefe > asedio > carrera). */
  private readonly top = el('div', 'top-line');
  private lines: { boss: string | null; raid: string | null; race: string | null } = { boss: null, raid: null, race: null };
  private readonly log = el('div', 'log');
  private readonly banner = el('div', 'banner');
  private readonly prompt = el('div', 'prompt-line');
  private readonly overlay = el('div', 'overlay');
  private readonly heartRow = el('div', 'stat');
  private readonly stamina = el('div', 'stamina');
  /** Taming ring: tap it (or A / E / Espacio). Outside `.hud` so it can take taps above the touch layer. */
  private readonly ring = el('div', 'tame-ring');
  onRingTap: () => void = () => {};
  /** El Marchito's vision card: its ✕ (or Enter) closes it; it also fades by itself. */
  private readonly visionCard = el('div', 'vision');
  private visionTimer: ReturnType<typeof setTimeout> | undefined;
  /** S5-G: the ending's steps still to show. */
  private endingQueue: EndingStep[] = [];
  menuOpen = false;

  /** True while any overlay panel (menu, death, fatal error) covers the screen. */
  get overlayOpen(): boolean {
    return !this.overlay.hidden;
  }

  /** P7-A: red screen edge when hurt; a slow pulse under 25 % health. */
  private readonly hurtEdge = el('div', 'hurt-edge');

  setHurt(edge: number, low: boolean): void {
    if (edge > 0) {
      this.hurtEdge.style.transition = 'none';
      this.hurtEdge.style.opacity = String(edge);
      void this.hurtEdge.offsetWidth; // restart the fade
      this.hurtEdge.style.transition = 'opacity 0.25s ease-out';
      this.hurtEdge.style.opacity = '0';
    }
    this.hurtEdge.classList.toggle('low', low);
  }

  constructor(parent: HTMLElement) {
    this.root.className = 'hud';
    const stats = el('div', 'stats');
    for (const [key, icon, color] of [['health', '❤️', 'var(--health)'], ['hunger', '🍖', 'var(--hunger)'], ['warmth', '🔥', 'var(--warmth)']] as const) {
      const row = el('div', 'stat');
      row.innerHTML = `<span>${icon}</span><div class="bar"><i style="background:${color}"></i></div><span class="val"></span>`;
      stats.appendChild(row);
      this.bars[key] = row;
    }
    this.heartRow.innerHTML = '<span>🌳</span><div class="bar"><i style="background:#5fd38a"></i></div><span class="val"></span>';
    this.heartRow.hidden = true;
    stats.appendChild(this.heartRow);
    this.top.hidden = true;
    this.banner.hidden = true;
    this.prompt.hidden = true;
    this.overlay.hidden = true;
    this.stamina.hidden = true;
    this.root.append(stats, this.log, this.banner, this.prompt, this.top, this.stamina, this.hurtEdge);
    this.ring.hidden = true;
    this.ring.innerHTML = '<svg viewBox="-80 -80 160 160"><circle r="60" class="track"/><path class="zone"/><line class="needle" x1="0" y1="0" x2="0" y2="-70"/></svg><span></span>';
    this.ring.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onRingTap();
    });
    this.visionCard.hidden = true;
    parent.append(this.root, this.ring, this.visionCard, this.overlay);
  }

  setVitals(v: Vitals): void {
    for (const k of Object.keys(this.bars) as (keyof Vitals)[]) {
      const row = this.bars[k];
      (row.querySelector('i') as HTMLElement).style.width = `${v[k]}%`;
      (row.querySelector('.val') as HTMLElement).textContent = vitalLabel(v[k]);
      row.classList.toggle('low', v[k] < 25);
    }
  }

  /** Stamina ring by the player; hidden when full, red while tired. */
  setStamina(frac: number, tired: boolean): void {
    const full = frac >= 1 && !tired;
    if (this.stamina.hidden !== full) this.stamina.hidden = full;
    if (full) return;
    this.stamina.style.setProperty('--p', `${Math.round(frac * 100)}%`);
    this.stamina.classList.toggle('tired', tired);
  }

  setInventory(inv: Inventory, weapon = 0, capa = 0, rank = ''): void {
    this.bag = { inv, weapon, capa, rank };
  }

  /** P7-C: 🎒 — the 7 materials, Arma, Capa and Rango. */
  showBag(onBack?: () => void): void {
    const rows = bagRows(this.bag.inv, this.bag.weapon, this.bag.capa, this.bag.rank);
    this.panel(
      `<h2>🎒 Mochila</h2><div class="bag">${rows.map((r) => `<div class="bag-cell${r.n === '0' ? ' empty' : ''}"><span class="ic">${r.icon}</span><b>${r.n}</b><small>${r.label}</small></div>`).join('')}</div>
       <button data-a="back">${onBack ? 'Volver' : 'Seguir jugando'}</button>`,
      { back: () => (onBack ? onBack() : this.hideOverlay()) },
    );
    this.menuOpen = true;
  }

  /** P7-B: every toast also sounds (set by the game). */
  onToast: ((text: string) => void) | null = null;

  toast(text: string): void {
    this.onToast?.(text);
    this.toasts.push(text, performance.now());
    this.renderToasts();
  }

  private renderToasts(): void {
    const now = performance.now();
    const list = this.toasts.tick(now);
    this.log.replaceChildren(...list.map((t) => {
      const d = el('div', '');
      d.textContent = toastText(t);
      return d;
    }));
    clearTimeout(this.toastTimer);
    if (list.length) this.toastTimer = setTimeout(() => this.renderToasts(), 250);
  }

  setHeart(h: { hp: number; max: number } | null, raid = false): void {
    this.heartRow.hidden = !heartShown(h, raid);
    if (!h || this.heartRow.hidden) return;
    (this.heartRow.querySelector('i') as HTMLElement).style.width = `${(h.hp / h.max) * 100}%`;
    (this.heartRow.querySelector('.val') as HTMLElement).textContent = h.hp > 0 ? String(h.hp) : 'marchito';
    this.heartRow.classList.toggle('low', h.hp < h.max * 0.25);
  }

  setRace(text: string | null): void {
    this.setLine('race', text);
  }

  setRaid(text: string | null): void {
    this.setLine('raid', text);
  }

  setBoss(text: string | null): void {
    this.setLine('boss', text);
  }

  private setLine(k: 'boss' | 'raid' | 'race', text: string | null): void {
    if (this.lines[k] === text) return;
    this.lines[k] = text;
    const t = topLine(this.lines.boss, this.lines.raid, this.lines.race);
    this.top.hidden = !t;
    if (!t) return;
    this.top.textContent = t.text;
    this.top.className = `top-line ${t.kind}`;
  }

  /** P7-C: text size (×1.25 for Grande) and the colour-blind shape marks. */
  setAccess(scale: number, marks: boolean): void {
    const app = this.root.parentElement;
    app?.style.setProperty('--ui-scale', String(scale));
    app?.classList.toggle('marks', marks);
  }

  /** Show the ring (angles in radians, 0 = top, clockwise), or hide it with null. */
  setRing(r: { needle: number; zone: number; width: number; round: number; rounds: number } | null): void {
    this.ring.hidden = !r;
    if (!r) return;
    const pt = (a: number) => `${(Math.sin(a) * 60).toFixed(1)} ${(-Math.cos(a) * 60).toFixed(1)}`;
    const a0 = r.zone - r.width / 2;
    const a1 = r.zone + r.width / 2;
    this.ring.querySelector('.zone')!.setAttribute('d', `M ${pt(a0)} A 60 60 0 ${r.width > Math.PI ? 1 : 0} 1 ${pt(a1)}`);
    this.ring.querySelector('.needle')!.setAttribute('transform', `rotate(${((r.needle * 180) / Math.PI).toFixed(1)})`);
    this.ring.querySelector('span')!.textContent = `Doma ${r.round + 1}/${r.rounds}`;
  }

  showVision(lines: string[], ms = 3000 + 2500 * lines.length, toast = true): void {
    this.visionCard.innerHTML = '';
    const roll = el('div', 'roll');
    for (const line of lines) {
      const p = el('p', '');
      p.textContent = line;
      roll.appendChild(p);
      if (toast) this.toast(line);
    }
    this.visionCard.appendChild(roll);
    const close = el('button', 'vision-close');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Cerrar visión');
    close.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideVision();
    });
    this.visionCard.appendChild(close);
    this.visionCard.hidden = false;
    clearTimeout(this.visionTimer);
    this.visionTimer = setTimeout(() => this.hideVision(), ms);
  }

  hideVision(): void {
    clearTimeout(this.visionTimer);
    this.visionCard.hidden = true;
    this.visionCard.classList.remove('credits');
    const next = this.endingQueue.shift();
    if (next) this.showStep(next);
  }

  /** S5-G: the long vision one card at a time, then the scrolling credits; ✕ / Enter skips a step. */
  showEnding(cards: string[], credits: string[]): void {
    this.endingQueue = endingSteps(cards, credits);
    this.showStep(this.endingQueue.shift()!);
  }

  private showStep(step: EndingStep): void {
    this.showVision(step.lines, step.ms, !step.credits);
    this.visionCard.classList.toggle('credits', step.credits);
    if (step.credits) this.visionCard.style.setProperty('--roll', `${step.ms / 1000}s`);
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = !text;
    this.prompt.textContent = text ?? '';
  }

  setStatus(s: NetStatus, onRetry: () => void): void {
    this.banner.hidden = s.kind === 'online';
    if (s.kind === 'connecting') this.banner.textContent = 'Conectando…';
    if (s.kind === 'reconnecting') this.banner.textContent = 'Reconectando…';
    if (s.kind !== 'fatal') return;
    this.banner.hidden = true;
    const again = s.code === 'version' ? 'Actualizar' : 'Volver';
    this.panel(`<h2>No se pudo entrar</h2><p>${FATAL[s.code]}</p><button data-a="retry">${again}</button>`, {
      retry: () => (s.code === 'version' ? location.reload() : onRetry()),
    });
  }

  /** P7-C: "Has caído." + a guessed cause + the revive countdown as a bar + a big Reaparecer; the world stays visible behind. */
  showDeath(onRespawn: () => void, cause = '', lowTier = false): void {
    this.panel(
      `<h2>Has caído.</h2>${cause ? `<p class="cause">${cause}</p>` : ''}<div class="revive"><i></i></div><p id="revive-left"></p><button class="big" data-a="respawn">Reaparecer</button><p class="note">Tu mochila se queda en una tumba aquí.</p>`,
      { respawn: onRespawn },
    );
    this.overlay.classList.add('dead');
    this.overlay.classList.toggle('veil', lowTier);
  }

  /** Death panel only: how long a teammate still has to get you up. */
  setReviveLeft(n: number): void {
    const p = this.overlay.querySelector('#revive-left');
    if (p) p.textContent = n > 0 ? `Un compañero puede levantarte: ${n} s` : 'Nadie vino.';
    const bar = this.overlay.querySelector<HTMLElement>('.revive i');
    if (bar) bar.style.width = `${Math.round(reviveFrac(n) * 100)}%`;
  }

  showMenu(tier: Tier, h: { onTier: (t: Tier) => void; onCamera: () => void; onLeave: () => void; trap: string; onTrap: () => void; fogatas?: number[]; onFogata?: (id: number) => void; calls?: { beast: string; label: string }[]; onCall?: (beast: string) => void; raids?: { label: string; on: boolean } | null; onRaids?: (on: boolean) => void; onSkills?: () => void; onLook?: () => void; onBook?: () => void; tripSecs?: number; stall?: string; onStall?: () => void; onStalls?: () => void; shake?: { value: string; options: [string, string][]; onChange: (v: string) => void }; vibrate?: { on: boolean; onChange: (on: boolean) => void }; sound?: { vols: { key: string; label: string; value: number }[]; mute: boolean; onVol: (key: string, v: number) => void; onMute: (on: boolean) => void } }): void {
    const where = (id: number) => (id === FOGATA.lookout ? `a la cima de ${NAMES.treeTower}`.replace("de el ", "del ") : id === FOGATA.ceniza ? `a ${NAMES.ash}` : id >= FOGATA.swamp ? `al ${NAMES.refugio} ${id - FOGATA.swamp + 1}` : `a la ${NAMES.fogata} ${id + 1}`);
    const trips = (h.fogatas ?? []).map((id) => `<button class="secondary" data-a="fogata${id}">Ir ${where(id)} (${h.tripSecs ?? 5} s, de día)</button>`).join('') + (h.calls ?? []).map((c) => `<button class="secondary" data-a="call-${c.beast}">${c.label}</button>`).join('');
    const options = (Object.keys(TIER_LABELS) as Tier[])
      .map((t) => `<option value="${t}" ${t === tier ? 'selected' : ''}>${TIER_LABELS[t]}</option>`)
      .join('');
    this.panel(
      `<h2>Menú</h2>
       <p>E golpear (o levantar a un compañero caído) · Q rodar · Z bloquear (justo a tiempo: parada) · R arco · X fijar objetivo</p>
       <p>Empuja contra un peñasco con enredadera para trepar (gasta aliento) · Espacio/B en el aire: planeador · Espacio/B trepando: saltar · Correr en el agua: nadar rápido</p>
       <p>Santuarios: haces de luz en el horizonte; cada uno da un orbe (+20 de aliento) · H / 🌿 ${NAMES.powerVine} (tras el primer orbe): hace crecer una enredadera trepable o cubre una roca lisa; los muros cerca de ella se regeneran · C cambia la cámara</p>
       <p>El ciervo salvaje (un halo dorado en el bosque): E / A junto a él para domarlo; pulsa cuando la aguja cruce la zona, tres veces · E / M montar y bajar · Shift: galope</p>
       <p>${NAMES.villain}: no se le puede matar. Golpes y paradas le quitan voluntad; si llega a 0, se va · Enter / ✕ cierra una visión</p>
       <p>Si ${NAMES.villain} se lleva al ${NAMES.bossForestShort}: está en una jaula de raíces en el fondo del mar, junto a la isla. Rompe las tres anclas (una por islote; el ${NAMES.powerWind} pega triple) y pulsa E / A junto a la jaula</p>
       <label>Calidad gráfica</label><select data-f="tier">${options}</select>
       ${h.shake ? `<label>Sacudida de cámara</label><select data-f="shake">${h.shake.options.map(([v, l]) => `<option value="${v}" ${v === h.shake!.value ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
       ${h.vibrate ? `<label>Vibración</label><select data-f="vibrate"><option value="1" ${h.vibrate.on ? 'selected' : ''}>Sí</option><option value="0" ${h.vibrate.on ? '' : 'selected'}>No</option></select>` : ''}
       ${h.sound ? `<label>Sonido</label><select data-f="mute"><option value="0" ${h.sound.mute ? '' : 'selected'}>Con sonido</option><option value="1" ${h.sound.mute ? 'selected' : ''}>🔇 Silencio (tecla .)</option></select>${h.sound.vols.map((v) => `<label>${v.label}</label><input type="range" min="0" max="100" step="5" value="${v.value}" data-vol="${v.key}" />`).join('')}` : ''}
       <button data-a="resume">Seguir jugando</button>
       <p>La ${NAMES.forestRoot}: palancas, un nudo que abre la ${NAMES.powerVine}, una losa (un compañero o el bloque encima), una linterna para el brasero y un ${NAMES.eliteForest}: cuando se agache, apártate o rueda. E / A coge y suelta</p>
       <p>Zonas moradas: el bosque marchito. De noche trae más bestias y los asedios vienen de la más cercana al Corazón. Se limpian con un orbe de santuario, con la ${NAMES.powerVine} junto a su raíz marchita o venciendo al ${NAMES.bossForestShort}</p>
       <p>Poderes: H lanza el elegido (🌿 ${NAMES.powerVine} / 🌬️ ${NAMES.powerWind} / 🔥 ${NAMES.powerFire} / 🪨 ${NAMES.powerStone}) · J cambia · en táctil, mantén pulsado el botón de poder medio segundo para cambiar. El ${NAMES.powerWind} (altar de la ${NAMES.coastRoot}) empuja bestias (el mar se las lleva), desliza la piedra pómez, gira molinos, arranca raíces marchitas de la costa y, planeando, te sube una vez por vuelo</p>
       <p>El ${NAMES.powerFire} (altar de la ${NAMES.swampRoot}, en medio de la Laguna Negra): 🔥 una llamarada corta. Quema bestias (los lobos huyen), enciende braseros y lámparas de gas, y quema espinas, turba y raíces marchitas del pantano</p>
       <p>La ${NAMES.powerStone} (altar de la cueva, junto a la ${NAMES.mountainRoot}): 🪨 alza un pilar delante de ti (3 como mucho, 2 minutos). Se trepa, pisa losas, frena a los asaltantes y a las cargas, y aplasta raíces marchitas de la montaña. E / A junto a un bloque de piedra lo empuja</p>
       <p>Trampas: T estacas (dañan y frenan) · Y red de raíces (atrapa unos segundos) · U hoguera (con el ${NAMES.powerFire}: quema a la primera bestia y espanta lobos) · I ${NAMES.tower} (con la ${NAMES.powerStone}: desde arriba las flechas llegan más lejos, y aparta a los asaltantes de su pie) · 🗡️ pone la elegida</p>
       <p>Fogatas del ${NAMES.biomeSwamp.replace(/^el /, '')}: enciéndelas con el ${NAMES.powerFire} o una antorcha de los Candiles. De día, E / A junto a una encendida te lleva al ${NAMES.heart} en 5 s; desde el ${NAMES.heart}, este menú te lleva a ellas. Un golpe o moverte lo corta</p>
       <p>${NAMES.ash.charAt(0).toUpperCase() + NAMES.ash.slice(1)} (${NAMES.biomeCorrupt}): su ${NAMES.fogata} se enciende igual. Junto a ella, este menú llama a tu ciervo, tu rana o tu pez. Los ${NAMES.flier.replace(' ', 's ')}s vuelan: flechas, o el ${NAMES.powerWind} los tira al suelo. Las bestias de allí sueltan ${NAMES.thorn.replace(' ', 's ')}s</p>
       ${trips}
       ${h.raids ? `<button class="secondary" data-a="raids">${h.raids.label}</button>` : ''}
       ${h.stall ? `<button class="secondary" data-a="stall">${h.stall}</button>` : ''}
       ${h.onStalls ? `<button class="secondary" data-a="stalls">Puestos</button>` : ''}
       ${h.onBook ? `<button class="secondary" data-a="book">${NAMES.book}</button>` : ''}
       ${h.onSkills ? `<button class="secondary" data-a="skills">${NAMES.skills}</button>` : ''}
       ${h.onLook ? `<button class="secondary" data-a="look">${NAMES.look}</button>` : ''}
       <button class="secondary" data-a="trap">Trampa: ${h.trap}</button>
       <button class="secondary" data-a="camera">Cambiar cámara</button>
       <button class="secondary" data-a="leave">Salir</button>`,
      { ...Object.fromEntries((h.fogatas ?? []).map((id) => [`fogata${id}`, () => { h.onFogata?.(id); this.hideOverlay(); }])), ...Object.fromEntries((h.calls ?? []).map((c) => [`call-${c.beast}`, () => { h.onCall?.(c.beast); this.hideOverlay(); }])), skills: () => h.onSkills?.(), look: () => h.onLook?.(), book: () => h.onBook?.(), stalls: () => h.onStalls?.(), stall: () => { h.onStall?.(); this.hideOverlay(); }, raids: () => { if (h.raids) h.onRaids?.(h.raids.on); this.hideOverlay(); }, resume: () => this.hideOverlay(), camera: () => { h.onCamera(); this.hideOverlay(); }, trap: () => { h.onTrap(); this.hideOverlay(); }, leave: h.onLeave },
    );
    this.menuOpen = true;
    this.overlay.querySelector('select[data-f="tier"]')!.addEventListener('change', (e) => h.onTier((e.target as HTMLSelectElement).value as Tier));
    this.overlay.querySelector('select[data-f="shake"]')?.addEventListener('change', (e) => h.shake?.onChange((e.target as HTMLSelectElement).value));
    this.overlay.querySelector('select[data-f="vibrate"]')?.addEventListener('change', (e) => h.vibrate?.onChange((e.target as HTMLSelectElement).value === '1'));
    this.overlay.querySelector('select[data-f="mute"]')?.addEventListener('change', (e) => h.sound?.onMute((e.target as HTMLSelectElement).value === '1'));
    this.overlay.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((el) => el.addEventListener('input', () => h.sound?.onVol(el.dataset.vol!, Number(el.value))));
  }

  /** P4-B: the Oficios panel (built by skills-ui); counts as the Menú for input. */
  showSkills(html: string, actions: Record<string, () => void>): void {
    this.panel(html, actions);
    this.menuOpen = true;
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.menuOpen = false;
  }

  private panel(html: string, actions: Record<string, () => void>): void {
    this.overlay.classList.remove('dead', 'veil');
    this.menuOpen = false; // only showMenu (below) sets this back to true; keeps it honest for death/fatal panels
    this.overlay.innerHTML = `<div class="panel">${html}</div>`;
    this.overlay.hidden = false;
    for (const b of this.overlay.querySelectorAll<HTMLElement>('[data-a]')) {
      b.addEventListener('click', () => actions[b.dataset.a!]?.());
    }
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
