import { ITEM_LABELS, ITEMS, type Inventory } from '../shared/items';
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
  private readonly inv = el('div', 'inventory-line');
  private readonly log = el('div', 'log');
  private readonly banner = el('div', 'banner');
  private readonly prompt = el('div', 'prompt-line');
  private readonly overlay = el('div', 'overlay');
  private readonly heartRow = el('div', 'stat');
  private readonly raidLine = el('div', 'raid-line');
  menuOpen = false;

  /** True while any overlay panel (menu, death, fatal error) covers the screen. */
  get overlayOpen(): boolean {
    return !this.overlay.hidden;
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
    this.raidLine.hidden = true;
    this.banner.hidden = true;
    this.prompt.hidden = true;
    this.overlay.hidden = true;
    this.root.append(stats, this.inv, this.log, this.banner, this.prompt, this.raidLine);
    parent.append(this.root, this.overlay);
  }

  setVitals(v: Vitals): void {
    for (const k of Object.keys(this.bars) as (keyof Vitals)[]) {
      const row = this.bars[k];
      (row.querySelector('i') as HTMLElement).style.width = `${v[k]}%`;
      (row.querySelector('.val') as HTMLElement).textContent = String(v[k]);
      row.classList.toggle('low', v[k] < 25);
    }
  }

  setInventory(inv: Inventory): void {
    const parts = ITEMS.filter((i) => (inv[i] ?? 0) > 0).map((i) => `${ITEM_LABELS[i]} ${inv[i]}`);
    this.inv.textContent = parts.length ? parts.join(' · ') : 'Mochila vacía';
  }

  toast(text: string): void {
    const d = el('div', '');
    d.textContent = text;
    this.log.prepend(d);
    setTimeout(() => d.remove(), 6000);
  }

  setHeart(h: { hp: number; max: number } | null): void {
    this.heartRow.hidden = !h;
    if (!h) return;
    (this.heartRow.querySelector('i') as HTMLElement).style.width = `${(h.hp / h.max) * 100}%`;
    (this.heartRow.querySelector('.val') as HTMLElement).textContent = h.hp > 0 ? String(h.hp) : 'marchito';
    this.heartRow.classList.toggle('low', h.hp < h.max * 0.25);
  }

  setRaid(text: string | null): void {
    this.raidLine.hidden = !text;
    if (text) this.raidLine.textContent = text;
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

  showDeath(onRespawn: () => void): void {
    this.panel('<h2>Has caído</h2><p>Conservas tu mochila.</p><button data-a="respawn">Reaparecer</button>', { respawn: onRespawn });
  }

  showMenu(tier: Tier, h: { onTier: (t: Tier) => void; onCamera: () => void; onLeave: () => void }): void {
    const options = (Object.keys(TIER_LABELS) as Tier[])
      .map((t) => `<option value="${t}" ${t === tier ? 'selected' : ''}>${TIER_LABELS[t]}</option>`)
      .join('');
    this.panel(
      `<h2>Menú</h2>
       <label>Calidad gráfica</label><select data-f="tier">${options}</select>
       <button data-a="resume">Seguir jugando</button>
       <button class="secondary" data-a="camera">Cambiar cámara</button>
       <button class="secondary" data-a="leave">Salir</button>`,
      { resume: () => this.hideOverlay(), camera: () => { h.onCamera(); this.hideOverlay(); }, leave: h.onLeave },
    );
    this.menuOpen = true;
    this.overlay.querySelector('select')!.addEventListener('change', (e) => h.onTier((e.target as HTMLSelectElement).value as Tier));
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.menuOpen = false;
  }

  private panel(html: string, actions: Record<string, () => void>): void {
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
