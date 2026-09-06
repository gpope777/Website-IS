import { ITEM_LABELS, RECIPES, canCraft, type Inventory, type ItemId, type Recipe, type Stats } from '../game/survival';
import type { Landmark, LandmarkId, Relic } from '../game/world';
import { HALF } from '../game/world';
import { isTouchDevice } from './touch';

const CONSUME_KEYS: Partial<Record<ItemId, string>> = { berries: '1', mushroom: '2', water: '3', torch: 'T', fish: '4' };

export const LANDMARK_ICONS: Record<LandmarkId, string> = { rock: '🗿', cabin: '🏚️', circle: '⭕', tree: '🌳', pier: '🛶', cave: '🕳️', exit: '🚪' };

export interface CompassMarker {
  /** Angle relative to the view direction, radians, negative = left. */
  rel: number;
  icon: string;
  dim: boolean;
  label: string;
}

export class Hud {
  readonly root: HTMLElement;
  private bars: Record<keyof Stats, { fill: HTMLElement; val: HTMLElement; row: HTMLElement }>;
  private clock: HTMLElement;
  private clockSub: HTMLElement;
  private inv: HTMLElement;
  private prompt: HTMLElement;
  private log: HTMLElement;
  private vignette: HTMLElement;
  private hand: HTMLElement;
  private compass: HTMLElement;
  private compassMarks: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    parent.appendChild(this.root);

    const clock = el('div', 'clock');
    this.clock = el('div');
    this.clockSub = el('div', 'sub');
    clock.append(this.clock, this.clockSub);

    const stats = el('div', 'stats');
    const make = (key: keyof Stats, icon: string, color: string) => {
      const row = el('div', 'stat');
      const ic = el('span');
      ic.textContent = icon;
      const bar = el('div', 'bar');
      const fill = document.createElement('i');
      fill.style.background = color;
      bar.appendChild(fill);
      const val = el('span', 'val');
      row.append(ic, bar, val);
      stats.appendChild(row);
      return { fill, val, row };
    };
    this.bars = {
      health: make('health', '❤', 'var(--health)'),
      hunger: make('hunger', '🍖', 'var(--hunger)'),
      thirst: make('thirst', '💧', 'var(--thirst)'),
      energy: make('energy', '⚡', 'var(--energy)'),
      warmth: make('warmth', '🔥', 'var(--warmth)'),
    };

    this.inv = el('div', 'inventory');
    this.prompt = el('div', 'prompt');
    this.log = el('div', 'log');
    this.vignette = el('div', 'vignette');
    this.hand = el('div', 'hand');
    this.compass = el('div', 'compass');
    this.compassMarks = el('div', 'marks');
    this.compass.append(this.compassMarks, el('i', 'needle'));

    this.root.append(this.vignette, clock, stats, this.inv, el('div', 'crosshair'), this.prompt, this.log, this.hand, this.compass);
  }

  setStats(s: Stats): void {
    for (const key of Object.keys(this.bars) as (keyof Stats)[]) {
      const b = this.bars[key];
      const v = s[key];
      b.fill.style.width = `${v}%`;
      b.val.textContent = Math.round(v).toString();
      b.row.classList.toggle('low', v < 20);
    }
    this.vignette.classList.toggle('hurt', s.health < 30);
    this.vignette.classList.toggle('cold', s.health >= 30 && s.warmth < 20);
  }

  setClock(day: number, dayFraction: number, night: boolean, phaseLabel: string): void {
    const minutes = Math.floor(dayFraction * 24 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    this.clock.innerHTML = `Día <b>${day}</b> · ${hh}:${mm}`;
    this.clockSub.textContent = night ? `${phaseLabel} — cuidado con los lobos` : phaseLabel;
  }

  /** Redraw the compass strip. Markers beyond ±100° are hidden. */
  setCompass(markers: CompassMarker[]): void {
    const span = (100 * Math.PI) / 180;
    let html = '';
    for (const m of markers) {
      if (Math.abs(m.rel) > span) continue;
      const x = 50 + (m.rel / span) * 50;
      html += `<span class="${m.dim ? 'dim' : ''}" style="left:${x.toFixed(1)}%" title="${m.label}">${m.icon}<small>${m.label}</small></span>`;
    }
    this.compassMarks.innerHTML = html;
  }

  /** Flash a punch/axe swing at the bottom of the screen. */
  swing(icon: string): void {
    this.hand.textContent = icon;
    this.hand.classList.remove('swing');
    void this.hand.offsetWidth;
    this.hand.classList.add('swing');
  }

  setInventory(inv: Inventory): void {
    const entries = Object.entries(inv).filter(([, n]) => (n ?? 0) > 0) as [ItemId, number][];
    let html = '<h4>Inventario</h4>';
    if (entries.length === 0) html += '<div class="empty">Vacío. Explora y recoge.</div>';
    else {
      html += '<ul>';
      for (const [id, n] of entries) {
        const key = CONSUME_KEYS[id];
        html += `<li><span>${key ? `<kbd>${key}</kbd>` : ''}${ITEM_LABELS[id]}</span><span>×${n}</span></li>`;
      }
      html += '</ul>';
    }
    html += '<div class="empty" style="margin-top:8px">C · crear objetos</div>';
    this.inv.innerHTML = html;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.remove('show');
      return;
    }
    this.prompt.innerHTML = text;
    this.prompt.classList.add('show');
  }

  notify(text: string, kind: 'info' | 'discover' = 'info'): void {
    const d = el('div', kind === 'discover' ? 'discover' : '');
    d.textContent = text;
    this.log.appendChild(d);
    while (this.log.children.length > 5) this.log.firstChild?.remove();
    setTimeout(() => d.remove(), 6000);
  }
}

// ---------------------------------------------------------------- overlays

const DESKTOP_KEYS = `
        <div><kbd>WASD</kbd> moverse</div><div><kbd>Ratón</kbd> mirar</div>
        <div><kbd>Shift</kbd> correr</div><div><kbd>Espacio</kbd> saltar</div>
        <div><kbd>E</kbd> interactuar</div><div><kbd>C</kbd> crear</div>
        <div><kbd>X / clic</kbd> golpear (puño, o hacha)</div><div><kbd>J</kbd> diario de exploración</div>
        <div><kbd>4</kbd> comer pescado</div><div><kbd>M</kbd> silenciar sonido</div>
        <div><kbd>1 2 3</kbd> comer / beber</div><div><kbd>T</kbd> antorcha</div>
        <div><kbd>F</kbd> colocar fogata</div><div><kbd>R</kbd> colocar refugio</div>`;

const TOUCH_KEYS = `
        <div><kbd>Joystick</kbd> moverse</div><div><kbd>Arrastrar</kbd> mirar</div>
        <div><kbd>Joystick al borde</kbd> correr</div><div><kbd>B</kbd> saltar</div>
        <div><kbd>A</kbd> interactuar</div><div><kbd>CREAR</kbd> crear objetos</div>
        <div><kbd>X</kbd> golpear (puño, o hacha)</div><div><kbd>DIARIO</kbd> lugares e historia</div>
        <div><kbd>1 2 3</kbd> comer / beber</div><div><kbd>T</kbd> antorcha</div>
        <div><kbd>F</kbd> colocar fogata</div><div><kbd>R</kbd> colocar refugio</div>`;

export function startOverlay(parent: HTMLElement, defaultSeed: string, onStart: (seed: string) => void): HTMLElement {
  const o = el('div', 'overlay');
  o.innerHTML = `
    <div class="panel">
      <h1>Bosque</h1>
      <p>Te has despertado en medio de un bosque sin recordar cómo llegaste. Explora, recoge recursos, mantente caliente
      y sobrevive tantos días como puedas. Sigue las columnas de luz: seis lugares guardan la historia de quien estuvo aquí antes, y la salida del bosque.</p>
      <div class="keys">${isTouchDevice() ? TOUCH_KEYS : DESKTOP_KEYS}</div>
      <p>El fuego te protege del frío y de los lobos. Las setas alimentan pero sientan mal. No dejes que ninguna barra llegue a cero.</p>
      <div class="seed"><label for="seed">Semilla del bosque</label><input id="seed" value="${defaultSeed}" /></div>
      <button id="start">Entrar al bosque</button>
    </div>`;
  parent.appendChild(o);
  const input = o.querySelector<HTMLInputElement>('#seed')!;
  o.querySelector('#start')!.addEventListener('click', () => {
    o.hidden = true;
    onStart(input.value.trim() || defaultSeed);
  });
  return o;
}

export function pauseOverlay(parent: HTMLElement, onResume: () => void): HTMLElement {
  const o = el('div', 'overlay');
  o.hidden = true;
  o.innerHTML = `
    <div class="panel">
      <h2>Pausa</h2>
      <p>${isTouchDevice() ? 'Toca Continuar para volver al bosque.' : 'Haz clic para volver al bosque.'} El tiempo no corre mientras estás aquí.</p>
      <button id="resume">Continuar</button>
    </div>`;
  parent.appendChild(o);
  o.querySelector('#resume')!.addEventListener('click', onResume);
  return o;
}

export function craftOverlay(parent: HTMLElement, onCraft: (r: Recipe) => void, onClose: () => void): { el: HTMLElement; refresh: (inv: Inventory) => void } {
  const o = el('div', 'overlay');
  o.hidden = true;
  o.innerHTML = `
    <div class="panel">
      <h2>Crear objetos</h2>
      <p>${isTouchDevice() ? 'Toca una receta para crearla.' : 'Pulsa el número para crear. <kbd>C</kbd> o <kbd>Esc</kbd> para cerrar.'}</p>
      <ul class="craft"></ul>
      <button class="secondary" id="close">Cerrar</button>
    </div>`;
  parent.appendChild(o);
  const list = o.querySelector('ul')!;
  o.querySelector('#close')!.addEventListener('click', onClose);
  const refresh = (inv: Inventory) => {
    list.innerHTML = '';
    RECIPES.forEach((r, i) => {
      const li = document.createElement('li');
      const ok = canCraft(inv, r);
      li.className = ok ? 'can' : 'no';
      const cost = Object.entries(r.cost)
        .map(([id, n]) => `${n} ${ITEM_LABELS[id as ItemId].toLowerCase()}`)
        .join(', ');
      li.innerHTML = `<span><kbd>${i + 1}</kbd>${r.label}<small>${cost}</small></span><span>${ok ? 'Crear' : '—'}</span>`;
      if (ok) li.addEventListener('click', () => onCraft(r));
      list.appendChild(li);
    });
  };
  return { el: o, refresh };
}

export function deathOverlay(parent: HTMLElement, onRestart: () => void): { el: HTMLElement; show: (cause: string, rows: [string, string][], title?: string) => void } {
  const o = el('div', 'overlay');
  o.hidden = true;
  parent.appendChild(o);
  const show = (cause: string, rows: [string, string][], title = 'El bosque te ha vencido') => {
    o.innerHTML = `
      <div class="panel">
        <h2>${title}</h2>
        <p>${cause}</p>
        <div class="stats-final">${rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>
        <button id="restart">Volver a intentarlo</button>
      </div>`;
    o.hidden = false;
    o.querySelector('#restart')!.addEventListener('click', onRestart);
  };
  return { el: o, show };
}

export interface JournalState {
  landmarks: Landmark[];
  relics: Relic[];
  player: { x: number; z: number; yaw: number };
}

export function journalOverlay(parent: HTMLElement, onClose: () => void): { el: HTMLElement; refresh: (s: JournalState) => void } {
  const o = el('div', 'overlay');
  o.hidden = true;
  o.innerHTML = `
    <div class="panel journal">
      <h2>Diario de exploración</h2>
      <p class="progress"></p>
      <div class="map-row"><canvas class="minimap" width="220" height="220"></canvas><div class="relics"><h4>Reliquias</h4><ul></ul></div></div>
      <ul class="places"></ul>
      <button class="secondary" id="close">Cerrar</button>
    </div>`;
  parent.appendChild(o);
  const list = o.querySelector('ul.places')!;
  const progress = o.querySelector('.progress')!;
  o.querySelector('#close')!.addEventListener('click', onClose);
  const canvas = o.querySelector<HTMLCanvasElement>('.minimap')!;
  const relicList = o.querySelector<HTMLElement>('.relics ul')!;
  const relicTitle = o.querySelector<HTMLElement>('.relics h4')!;
  const drawMap = (s: JournalState) => {
    const c = canvas.getContext('2d')!;
    const W = canvas.width;
    const px = (v: number) => ((v + HALF) / (HALF * 2)) * W;
    c.fillStyle = '#1b2a20';
    c.fillRect(0, 0, W, W);
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.strokeRect(0.5, 0.5, W - 1, W - 1);
    for (const r of s.relics) {
      if (!r.found) continue;
      c.fillStyle = 'rgba(255,224,138,0.5)';
      c.beginPath();
      c.arc(px(r.position.x), px(r.position.z), 2, 0, Math.PI * 2);
      c.fill();
    }
    c.font = '14px system-ui';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const l of s.landmarks) {
      if (!l.revealed) continue;
      c.globalAlpha = l.discovered ? 1 : 0.5;
      c.fillText(LANDMARK_ICONS[l.id], px(l.position.x), px(l.position.z));
    }
    c.globalAlpha = 1;
    const x = px(s.player.x);
    const y = px(s.player.z);
    c.fillStyle = '#f0b35a';
    c.beginPath();
    c.moveTo(x - Math.sin(s.player.yaw) * 8, y - Math.cos(s.player.yaw) * 8);
    c.lineTo(x + Math.sin(s.player.yaw + 2.5) * 5, y + Math.cos(s.player.yaw + 2.5) * 5);
    c.lineTo(x + Math.sin(s.player.yaw - 2.5) * 5, y + Math.cos(s.player.yaw - 2.5) * 5);
    c.closePath();
    c.fill();
  };
  const refresh = (s: JournalState) => {
    const { landmarks } = s;
    drawMap(s);
    const foundRelics = s.relics.filter((r) => r.found);
    relicTitle.textContent = `Reliquias ${foundRelics.length} / ${s.relics.length}`;
    relicList.innerHTML = foundRelics.length
      ? foundRelics.map((r) => `<li><b>${r.name}</b><br><small>${r.lore}</small></li>`).join('')
      : '<li><small>Busca destellos dorados cerca de los lugares. Cada reliquia cuenta una parte de la historia.</small></li>';
    const found = landmarks.filter((l) => l.discovered).length;
    const total = landmarks.filter((l) => l.id !== 'exit').length;
    progress.textContent = found >= total
      ? 'Conoces todos los lugares. La Puerta del Bosque te espera.'
      : `${found} de ${total} lugares descubiertos. Cada uno guarda una página del diario del ermitaño.`;
    list.innerHTML = '';
    for (const l of landmarks) {
      const li = document.createElement('li');
      if (l.discovered) {
        li.className = 'found';
        li.innerHTML = `<b>${LANDMARK_ICONS[l.id]} ${l.name}</b><p>${l.description}</p><blockquote>${l.story}</blockquote><small>${l.reward}</small>`;
      } else if (l.revealed) {
        li.className = 'known';
        li.innerHTML = `<b>${LANDMARK_ICONS[l.id]} ${l.name}</b><p>Marcado en la brújula. Aún no lo has visitado.</p>`;
      } else {
        li.className = 'unknown';
        li.innerHTML = `<b>❔ Lugar desconocido</b><p>Busca una columna de luz en el horizonte.</p>`;
      }
      list.appendChild(li);
    }
  };
  return { el: o, refresh };
}

function el(tag: string, cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
