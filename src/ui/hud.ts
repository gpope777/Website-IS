import { ITEM_LABELS, RECIPES, canCraft, type Inventory, type ItemId, type Recipe, type Stats } from '../game/survival';
import { isTouchDevice } from './touch';

const CONSUME_KEYS: Partial<Record<ItemId, string>> = { berries: '1', mushroom: '2', water: '3', torch: 'T' };

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

    this.root.append(this.vignette, clock, stats, this.inv, el('div', 'crosshair'), this.prompt, this.log, this.hand);
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
        <div><kbd>X / clic</kbd> golpear (puño, o hacha)</div>
        <div><kbd>1 2 3</kbd> comer / beber</div><div><kbd>T</kbd> antorcha</div>
        <div><kbd>F</kbd> colocar fogata</div><div><kbd>R</kbd> colocar refugio</div>`;

const TOUCH_KEYS = `
        <div><kbd>Joystick</kbd> moverse</div><div><kbd>Arrastrar</kbd> mirar</div>
        <div><kbd>Joystick al borde</kbd> correr</div><div><kbd>B</kbd> saltar</div>
        <div><kbd>A</kbd> interactuar</div><div><kbd>CREAR</kbd> crear objetos</div>
        <div><kbd>X</kbd> golpear (puño, o hacha)</div>
        <div><kbd>1 2 3</kbd> comer / beber</div><div><kbd>T</kbd> antorcha</div>
        <div><kbd>F</kbd> colocar fogata</div><div><kbd>R</kbd> colocar refugio</div>`;

export function startOverlay(parent: HTMLElement, defaultSeed: string, onStart: (seed: string) => void): HTMLElement {
  const o = el('div', 'overlay');
  o.innerHTML = `
    <div class="panel">
      <h1>Bosque</h1>
      <p>Te has despertado en medio de un bosque sin recordar cómo llegaste. Explora, recoge recursos, mantente caliente
      y sobrevive tantos días como puedas. Hay cinco lugares que descubrir.</p>
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

export function deathOverlay(parent: HTMLElement, onRestart: () => void): { el: HTMLElement; show: (cause: string, rows: [string, string][]) => void } {
  const o = el('div', 'overlay');
  o.hidden = true;
  parent.appendChild(o);
  const show = (cause: string, rows: [string, string][]) => {
    o.innerHTML = `
      <div class="panel">
        <h2>El bosque te ha vencido</h2>
        <p>${cause}</p>
        <div class="stats-final">${rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>
        <button id="restart">Volver a intentarlo</button>
      </div>`;
    o.hidden = false;
    o.querySelector('#restart')!.addEventListener('click', onRestart);
  };
  return { el: o, show };
}

function el(tag: string, cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
