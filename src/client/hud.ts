import { NAMES } from '../shared/names';
import { FOGATA } from '../shared/fogatas';
import { endingSteps, type EndingStep } from './ending-ui';
import type { Inventory } from '../shared/items';
import { bagRows, heartShown, reviveFrac, Toasts, toastText, topLine, vitalLabel } from './hud-model';
import type { ErrorCode } from '../shared/protocol';
import type { Vitals } from '../shared/survival';
import type { NetStatus } from './net';
import { TIER_LABELS, type Tier } from './quality';
import { helpHtml, tabsHtml, type HelpCard, type MenuTab } from './menu-ui';

/** P7-C: what the Menú needs from the game. */
export interface MenuHandlers {
  onTier: (t: Tier) => void;
  onCamera: () => void;
  /** Button text for the camera (the view it switches to) and after a switch. */
  camera?: string;
  cameraNext?: string;
  onLeave: () => void;
  trap: string;
  onTrap: () => void;
  fogatas?: number[];
  onFogata?: (id: number) => void;
  calls?: { beast: string; label: string }[];
  onCall?: (beast: string) => void;
  raids?: { label: string; on: boolean } | null;
  onRaids?: (on: boolean) => void;
  onSkills?: () => void;
  onLook?: () => void;
  onBook?: () => void;
  onBag?: () => void;
  tripSecs?: number;
  stall?: string;
  onStall?: () => void;
  onStalls?: () => void;
  onTab?: (t: MenuTab) => void;
  help?: readonly HelpCard[];
  shake?: { value: string; options: [string, string][]; onChange: (v: string) => void };
  vibrate?: { on: boolean; onChange: (on: boolean) => void };
  sound?: { vols: { key: string; label: string; value: number }[]; mute: boolean; onVol: (key: string, v: number) => void; onMute: (on: boolean) => void };
  sens?: { value: number; onChange: (v: number) => void };
  text?: { value: string; options: [string, string][]; onChange: (v: string) => void };
  marks?: { on: boolean; onChange: (on: boolean) => void };
  /** P7-D: "Mostrar Qué sigue" and "Consejos". */
  guide?: { on: boolean; onChange: (on: boolean) => void };
  tips?: { on: boolean; onChange: (on: boolean) => void };
  /** P7-D: tabs with something new. */
  dots?: Partial<Record<MenuTab, boolean>>;
}

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

  /** P7-D: "Qué sigue": one line at the top centre, a tip under it, and an arrow on the screen edge. */
  private readonly goal = el('button', 'goal');
  private readonly goalTip = el('div', 'goal-tip');
  private readonly edge = el('div', 'edge-arrow');
  private goalText = '';
  onGoalTap: () => void = () => {};

  setGoal(text: string | null, alpha = 1): void {
    const t = text ?? '';
    if (t !== this.goalText) {
      this.goalText = t;
      this.goal.textContent = t;
      this.goal.hidden = !t;
    }
    const a = String(alpha);
    if (this.goal.style.opacity !== a) this.goal.style.opacity = a;
  }

  setTip(text: string | null): void {
    const t = text ?? '';
    if (this.goalTip.textContent !== t) this.goalTip.textContent = t;
    this.goalTip.hidden = !t;
  }

  /** Screen px and degrees (0 = up), or null to hide. */
  setArrow(a: { x: number; y: number; deg: number } | null): void {
    if (!a) {
      if (!this.edge.hidden) this.edge.hidden = true;
      return;
    }
    this.edge.hidden = false;
    this.edge.style.transform = `translate(${a.x.toFixed(0)}px, ${a.y.toFixed(0)}px) translate(-50%, -50%) rotate(${a.deg.toFixed(0)}deg)`;
  }

  /** P7-D: El eco del bosque — the vision card, but green and quiet. */
  showEcho(lines: string[]): void {
    this.showVision(['Mientras no estabas:', ...lines], 6000, false);
    this.visionCard.classList.add('echo');
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
    this.goal.hidden = true;
    this.goalTip.hidden = true;
    this.edge.hidden = true;
    this.edge.textContent = '▲';
    this.goal.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.goal.style.opacity = '1';
      this.onGoalTap();
    });
    this.root.append(stats, this.log, this.banner, this.prompt, this.top, this.stamina, this.hurtEdge, this.goal, this.goalTip, this.edge);
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
    this.visionCard.classList.remove('echo');
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
    this.visionCard.classList.remove('credits', 'echo');
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

  /** P7-C: the tabbed Menú — Jugar · Libro · Ajustes · Ayuda · Salir (spec §5.2). Tabs swap in place; the last one is remembered by the game. */
  showMenu(tier: Tier, h: MenuHandlers, tab: MenuTab = 'jugar'): void {
    const where = (id: number) => (id === FOGATA.lookout ? `a la cima de ${NAMES.treeTower}`.replace('de el ', 'del ') : id === FOGATA.ceniza ? `a ${NAMES.ash}` : id >= FOGATA.swamp ? `al ${NAMES.refugio} ${id - FOGATA.swamp + 1}` : `a la ${NAMES.fogata} ${id + 1}`);
    const sel = (f: string, opts: [string, string][], v: string) => `<select data-f="${f}">${opts.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const btn = (a: string, label: string) => `<button class="secondary wide" data-a="${a}">${label}</button>`;
    let body = '';
    if (tab === 'jugar') {
      body = `<button class="wide" data-a="resume">Seguir jugando</button>
        ${btn('bag', '🎒 Mochila')}
        ${(h.fogatas ?? []).map((id) => btn(`fogata${id}`, `Ir ${where(id)} (${h.tripSecs ?? 5} s, de día)`)).join('')}
        ${(h.calls ?? []).map((c) => btn(`call-${c.beast}`, c.label)).join('')}
        ${btn('trap', `Trampa: ${h.trap}`)}
        ${h.raids ? btn('raids', h.raids.label) : ''}
        ${h.stall ? btn('stall', h.stall) : ''}
        ${h.onStalls ? btn('stalls', 'Puestos') : ''}`;
    } else if (tab === 'libro') {
      body = `${h.onBook ? btn('book', NAMES.book) : ''}${h.onSkills ? btn('skills', NAMES.skills) : ''}${h.onLook ? btn('look', NAMES.look) : ''}`;
    } else if (tab === 'ajustes') {
      const tiers = (Object.keys(TIER_LABELS) as Tier[]).map((t): [string, string] => [t, TIER_LABELS[t]]);
      const yes = (on: boolean) => (on ? '1' : '0');
      body = `<div class="settings">
        <label>Calidad gráfica</label>${sel('tier', tiers, tier)}
        <label>Cámara</label>${btn('camera', h.camera ?? 'Cambiar cámara')}
        ${h.sens ? `<label>Sensibilidad de cámara · <span data-o="sens">${h.sens.value.toFixed(2).replace('.', ',')}×</span></label><input type="range" min="0.5" max="2" step="0.25" value="${h.sens.value}" data-f="sens" />` : ''}
        ${h.shake ? `<label>Sacudida de cámara</label>${sel('shake', h.shake.options, h.shake.value)}` : ''}
        ${h.vibrate ? `<label>Vibración</label>${sel('vibrate', [['1', 'Sí'], ['0', 'No']], yes(h.vibrate.on))}` : ''}
        ${h.sound ? `<label>Sonido</label>${sel('mute', [['0', 'Con sonido'], ['1', '🔇 Silencio (tecla .)']], yes(h.sound.mute))}${h.sound.vols.map((v) => `<label>${v.label}</label><input type="range" min="0" max="100" step="5" value="${v.value}" data-vol="${v.key}" />`).join('')}` : ''}
        ${h.text ? `<label>Tamaño de texto</label>${sel('text', h.text.options, h.text.value)}` : ''}
        ${h.marks ? `<label>Marcas de forma (además del color)</label>${sel('marks', [['1', 'Sí'], ['0', 'No']], yes(h.marks.on))}` : ''}
        ${h.guide ? `<label>Mostrar "Qué sigue"</label>${sel('guide', [['1', 'Sí'], ['0', 'No']], yes(h.guide.on))}` : ''}
        ${h.tips ? `<label>Consejos</label>${sel('tips', [['1', 'Sí'], ['0', 'No']], yes(h.tips.on))}` : ''}
      </div>`;
    } else if (tab === 'ayuda') {
      body = helpHtml(h.help ?? []);
    } else {
      body = `<p>¿Salir del mundo? Tu progreso ya está guardado.</p><button class="wide" data-a="leave">Salir</button>${btn('resume', 'Seguir jugando')}`;
    }
    const go = (fn?: () => void) => () => {
      this.hideOverlay();
      fn?.();
    };
    const actions: Record<string, () => void> = {
      ...Object.fromEntries((h.fogatas ?? []).map((id) => [`fogata${id}`, go(() => h.onFogata?.(id))])),
      ...Object.fromEntries((h.calls ?? []).map((c) => [`call-${c.beast}`, go(() => h.onCall?.(c.beast))])),
      skills: () => h.onSkills?.(),
      look: () => h.onLook?.(),
      book: () => h.onBook?.(),
      stalls: () => h.onStalls?.(),
      bag: () => h.onBag?.(),
      stall: go(h.onStall),
      raids: go(() => h.raids && h.onRaids?.(h.raids.on)),
      resume: go(),
      camera: () => {
        h.onCamera();
        this.showMenu(tier, { ...h, camera: h.cameraNext, cameraNext: h.camera }, tab);
      },
      trap: go(h.onTrap),
      leave: h.onLeave,
    };
    this.panel(`<h2 class="menu-title">Menú</h2>${tabsHtml(tab, h.dots)}<div class="tab-body">${body}</div>`, actions);
    this.overlay.querySelector('.panel')!.classList.add('menu');
    this.menuOpen = true;
    for (const b of this.overlay.querySelectorAll<HTMLElement>('[data-tab]')) {
      b.addEventListener('click', () => {
        const t = b.dataset.tab as MenuTab;
        h.onTab?.(t);
        this.showMenu(tier, { ...h, dots: { ...h.dots, [t]: false } }, t);
      });
    }
    const on = (f: string, fn: (v: string) => void, ev = 'change') => this.overlay.querySelector<HTMLInputElement>(`[data-f="${f}"]`)?.addEventListener(ev, (e) => fn((e.target as HTMLInputElement).value));
    on('tier', (v) => h.onTier(v as Tier));
    on('shake', (v) => h.shake?.onChange(v));
    on('vibrate', (v) => h.vibrate?.onChange(v === '1'));
    on('mute', (v) => h.sound?.onMute(v === '1'));
    on('text', (v) => h.text?.onChange(v));
    on('marks', (v) => h.marks?.onChange(v === '1'));
    on('guide', (v) => h.guide?.onChange(v === '1'));
    on('tips', (v) => h.tips?.onChange(v === '1'));
    on('sens', (v) => {
      h.sens?.onChange(Number(v));
      const o = this.overlay.querySelector('[data-o="sens"]');
      if (o) o.textContent = `${Number(v).toFixed(2).replace('.', ',')}×`;
    }, 'input');
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
