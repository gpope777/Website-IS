import type { Tier } from './quality';

const SHORT: Record<Tier, string> = { low: 'Baja', medium: 'Media', high: 'Alta' };

/** `?fps=1` line: "58 fps · Media" (+ "· ×0,85" when the guard lowered the pixel ratio). */
export function fpsText(fps: number, tier: Tier, scale: number): string {
  const s = scale < 1 ? ` · ×${scale.toFixed(2).replace('.', ',')}` : '';
  return `${Math.round(fps)} fps · ${SHORT[tier]}${s}`;
}

/** Mean fps over half-second blocks; `feed` returns it when a block closes. */
export class FpsCounter {
  private t = 0;
  private n = 0;

  feed(dt: number): number | null {
    this.t += dt;
    this.n++;
    if (this.t < 0.5 - 1e-9) return null;
    const fps = this.n / this.t;
    this.t = 0;
    this.n = 0;
    return fps;
  }
}

/** The on-screen counter for phones (`?fps=1`): a small fixed label, no input. */
export class FpsMeter {
  private readonly el = document.createElement('div');
  private readonly counter = new FpsCounter();

  constructor(parent: HTMLElement) {
    this.el.style.cssText = 'position:fixed;top:4px;left:4px;z-index:50;pointer-events:none;font:12px/1.2 monospace;color:#fff;background:rgba(0,0,0,.45);padding:2px 5px;border-radius:3px';
    parent.appendChild(this.el);
  }

  update(dt: number, tier: Tier, scale: number): void {
    const fps = this.counter.feed(dt);
    if (fps !== null) this.el.textContent = fpsText(fps, tier, scale);
  }
}
