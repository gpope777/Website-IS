export interface WheelItem { icon: string; text: string }

export function sectorAt(dx: number, dy: number, n: number, dead = 28): number | null {
  if (n <= 0 || Math.hypot(dx, dy) < dead) return null;
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor((a + Math.PI / n) / (Math.PI * 2 / n)) % n;
}

export class Wheel {
  private root: HTMLElement | null = null;
  private centre = { x: 0, y: 0 };
  private items: WheelItem[] = [];
  private pick: ((i: number | null) => void) | null = null;
  private selected: number | null = null;

  constructor(private readonly parent: HTMLElement) {}
  get isOpen(): boolean { return !!this.root; }

  open(x: number, y: number, items: WheelItem[], pick: (i: number | null) => void): void {
    this.close();
    this.items = items.slice(0, 6);
    this.pick = pick;
    this.centre = { x, y };
    const root = document.createElement('div');
    root.className = 'wheel';
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    this.items.forEach((item, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<b>${item.icon}</b><span>${item.text}</span>`;
      const a = (i / this.items.length) * Math.PI * 2 - Math.PI / 2;
      b.style.transform = `translate(${Math.cos(a) * 80}px, ${Math.sin(a) * 80}px) translate(-50%, -50%)`;
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); this.tap(i); });
      root.appendChild(b);
    });
    this.parent.appendChild(root);
    this.root = root;
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  move(x: number, y: number): void {
    if (!this.root) return;
    this.selected = sectorAt(x - this.centre.x, y - this.centre.y, this.items.length);
    [...this.root.children].forEach((el, i) => el.classList.toggle('on', i === this.selected));
  }

  release(x: number, y: number): void {
    if (!this.root) return;
    const d = Math.hypot(x - this.centre.x, y - this.centre.y);
    this.move(x, y);
    if (d > 110) this.finish(null);
    else if (this.selected !== null) this.finish(this.selected);
  }

  tap(i: number): void { if (this.root && i >= 0 && i < this.items.length) this.finish(i); }
  close(): void { if (this.root) this.finish(null, false); }

  private finish(i: number | null, tell = true): void {
    const pick = this.pick;
    this.root?.remove();
    this.root = null;
    this.pick = null;
    this.selected = null;
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    if (tell) pick?.(i);
  }

  private onKey = (e: KeyboardEvent): void => {
    const i = /^Digit[1-6]$/.test(e.code) ? Number(e.code.slice(-1)) - 1 : -1;
    if (i >= 0 && i < this.items.length) { e.preventDefault(); this.tap(i); }
    else if (e.code === 'Escape') this.close();
  };
  private onPointerMove = (e: PointerEvent): void => this.move(e.clientX, e.clientY);
  private onPointerUp = (e: PointerEvent): void => this.release(e.clientX, e.clientY);
}
