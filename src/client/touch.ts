import type { InputState } from './input';
import { Wheel } from './wheel';

/**
 * True on phones/tablets. Checks, in order: an explicit `?touch=1|0` override,
 * a coarse primary pointer, and finally the presence of touch points on a small screen.
 * The game also switches on touch controls lazily on the first touch event, so this
 * only decides what the start screen shows.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = new URLSearchParams(window.location.search).get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
  const points = navigator.maxTouchPoints ?? 0;
  return points > 0 && Math.min(window.innerWidth, window.innerHeight) <= 900;
}

export interface TouchHandlers {
  /** Camera look delta in "mouse pixels". */
  onLook: (dx: number, dy: number) => void;
  /** A momentary action, expressed as a KeyboardEvent.code so it shares the keyboard path. */
  onAction: (code: string) => void;
  onAttackDown?: () => void;
  onAttackUp?: () => void;
  onRollDown?: () => void;
  onRollUp?: () => void;
  onPowerWheel?: () => { icon: string; text: string; code: string }[];
  onBagWheel?: () => { icon: string; text: string; code: string }[];
  onTapWorld?: (x: number, y: number) => boolean;
  onPause: () => void;
  /** P7-C: 🎒 opens the bag. */
  onBag?: () => void;
  /** P7-D: a dotted pill was tapped. */
  onPillSeen?: (i: number) => void;
}

interface ButtonDef {
  code: string;
  label: string;
  sub?: string;
  cls: string;
  /** Held buttons toggle an InputState flag instead of firing an action. */
  hold?: keyof InputState;
}

const ACTION_BUTTONS: ButtonDef[] = [
  { code: 'KeyE', label: '⚔', sub: 'atacar', cls: 'btn-attack' },
  { code: 'Space', label: '↑', sub: 'saltar', cls: 'btn-jump', hold: 'jump' },
  { code: 'TouchRoll', label: '🌀', sub: 'rodar', cls: 'btn-roll' },
  { code: 'KeyH', label: '🌿', sub: 'poder', cls: 'btn-power' },
  { code: 'TouchBag', label: '🎒', sub: 'mochila', cls: 'btn-bag' },
];

/** Holding the power pill this long switches powers. */
const POWER_HOLD_MS = 300;
const STICK_RADIUS = 52; // px the knob can travel from centre
const DEAD_ZONE = 0.12;
const SPRINT_ZONE = 0.92;
const LOOK_GAIN = 2.6; // touch drags are shorter than mouse sweeps

/**
 * Transparent on-screen controls in the spirit of a GBA emulator overlay:
 * a virtual analog stick on the left, drag-to-look anywhere else,
 * A/B action buttons on the right and small pills for the item shortcuts.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private stickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private lookDown = { x: 0, y: 0, at: 0 };
  private readonly stickBase: HTMLElement;
  private readonly knob: HTMLElement;
  private stickCentre = { x: 0, y: 0 };

  private powerPill: HTMLElement | null = null;
  private readonly controls = new Map<string, HTMLElement>();
  private dottedPills: boolean[] = [];
  private readonly wheel: Wheel;
  private menuBtn: HTMLElement | null = null;
  private actBtn: HTMLElement | null = null;

  constructor(parent: HTMLElement, private readonly input: InputState, private readonly h: TouchHandlers) {
    this.root = div('touch-layer');
    this.wheel = new Wheel(parent);
    parent.appendChild(this.root);

    // Look zone sits underneath everything else and covers the whole screen.
    const look = div('touch-look');
    look.addEventListener('pointerdown', this.onLookDown);
    look.addEventListener('pointermove', this.onLookMove);
    look.addEventListener('pointerup', this.onLookUp);
    look.addEventListener('pointercancel', this.onLookUp);

    this.stickBase = div('touch-stick');
    this.knob = div('touch-knob');
    this.stickBase.appendChild(this.knob);
    this.stickBase.addEventListener('pointerdown', this.onStickDown);
    this.stickBase.addEventListener('pointermove', this.onStickMove);
    this.stickBase.addEventListener('pointerup', this.onStickUp);
    this.stickBase.addEventListener('pointercancel', this.onStickUp);

    const actions = div('touch-actions');
    for (const b of ACTION_BUTTONS) {
      const el = this.button(b);
      if (b.code === 'KeyE') this.actBtn = el;
      if (b.code === 'KeyH') this.powerPill = el;
      this.controls.set(b.code, el);
      if (b.code === 'TouchBag' || b.code === 'KeyH') el.addEventListener('pointerdown', () => {
        const range = b.code === 'TouchBag' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
        for (const i of range.filter((n) => this.dottedPills[n])) this.h.onPillSeen?.(i);
      });
      actions.appendChild(el);
    }

    const system = div('touch-system');
    const menu = this.button({ code: '', label: 'MENÚ', cls: 'sys menu-btn' });
    this.menuBtn = menu;
    menu.addEventListener('pointerup', (e) => {
      e.preventDefault();
      h.onPause();
    });
    system.append(menu);

    this.root.append(look, this.stickBase, actions, system);

    // iOS Safari ignores `user-scalable=no`: double-tap and pinch still zoom the page and there is
    // no way back for the player. Cancel those gestures at the source while the controls exist.
    this.root.addEventListener('touchstart', this.blockGesture, { passive: false });
    this.root.addEventListener('touchmove', this.blockGesture, { passive: false });
    this.root.addEventListener('touchend', this.blockDoubleTap, { passive: false });
    document.addEventListener('gesturestart', this.blockGesture, { passive: false });
    document.addEventListener('gesturechange', this.blockGesture, { passive: false });
    document.addEventListener('dblclick', this.blockGesture, { passive: false });
  }

  private lastTapEnd = 0;

  private blockGesture = (e: Event): void => {
    if (e.cancelable) e.preventDefault();
  };

  private blockDoubleTap = (e: TouchEvent): void => {
    const now = performance.now();
    if (now - this.lastTapEnd < 350 && e.cancelable) e.preventDefault();
    this.lastTapEnd = now;
    // Always cancel on our own controls so Safari never synthesises a zoom from the tap.
    if (e.cancelable) e.preventDefault();
  };

  /** P7-C: show the pills by progress; a hidden one keeps its slot (the grid never reorders). */
  setPills(shown: readonly boolean[]): void {
    void shown; // wheel contents are supplied lazily by game.ts
  }

  /** P7-D: "new" dots on MENÚ and on pills that just appeared. */
  setDots(menu: boolean, pills: readonly boolean[]): void {
    this.dottedPills = [...pills];
    this.menuBtn?.classList.toggle('new', menu);
    this.controls.get('TouchBag')?.classList.toggle('new', pills.slice(0, 5).some(Boolean));
    this.controls.get('KeyH')?.classList.toggle('new', pills.slice(5).some(Boolean));
  }

  /** P7-F: the tutorial's glowing controls: 'act' (A), 'stick', or pill slots by index. */
  setHint(controls: readonly boolean[], stick: boolean): void {
    const set = (e: HTMLElement | null, on: boolean) => {
      if (e && e.classList.contains('hint') !== on) e.classList.toggle('hint', on);
    };
    for (const [i, code] of ['KeyE', 'Space', 'TouchRoll', 'KeyH', 'TouchBag'].entries()) set(this.controls.get(code) ?? null, !!controls[i]);
    set(this.stickBase, stick);
  }

  setActIcon(icon: string | null): void {
    const span = this.actBtn?.querySelector('span');
    if (span) span.textContent = icon ?? '⚔';
  }

  setDim(dim: readonly boolean[]): void {
    for (const [i, code] of ['KeyE', 'Space', 'TouchRoll', 'KeyH', 'TouchBag'].entries()) this.controls.get(code)?.classList.toggle('dim', !!dim[i]);
  }

  /** The power pill's icon follows the chosen power. */
  setPowerIcon(icon: string): void {
    const span = this.powerPill?.querySelector('span');
    if (span) span.textContent = icon;
  }

  /** Clear every held flag, e.g. when the game pauses or a menu opens. */
  release(): void {
    this.stickPointer = null;
    this.lookPointer = null;
    this.setAxis(0, 0);
    this.input.jump = false;
    this.input.block = false;
    this.knob.style.transform = '';
    this.stickBase.classList.remove('active', 'floating');
    this.wheel.close();
  }

  dispose(): void {
    this.release();
    document.removeEventListener('gesturestart', this.blockGesture);
    document.removeEventListener('gesturechange', this.blockGesture);
    document.removeEventListener('dblclick', this.blockGesture);
    this.wheel.close();
    this.root.remove();
  }

  // ---------------------------------------------------------------- stick

  private onStickDown = (e: PointerEvent): void => {
    if (this.stickPointer !== null) return;
    e.preventDefault();
    this.stickPointer = e.pointerId;
    this.stickBase.setPointerCapture(e.pointerId);
    const r = this.stickBase.getBoundingClientRect();
    this.stickCentre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.stickBase.classList.add('active');
    this.moveStick(e.clientX, e.clientY);
  };

  private onStickMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointer) return;
    e.preventDefault();
    this.moveStick(e.clientX, e.clientY);
  };

  private onStickUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.stickBase.classList.remove('active');
    this.knob.style.transform = '';
    this.setAxis(0, 0);
  };

  private moveStick(px: number, py: number): void {
    let dx = px - this.stickCentre.x;
    let dy = py - this.stickCentre.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.setAxis(dx / STICK_RADIUS, dy / STICK_RADIUS);
  }

  private setAxis(x: number, z: number): void {
    const mag = Math.hypot(x, z);
    if (mag < DEAD_ZONE) {
      this.input.axis = undefined;
      this.input.forward = this.input.back = this.input.left = this.input.right = false;
      this.input.sprint = false;
      return;
    }
    // Rescale so the dead zone edge maps to 0 and the rim to 1.
    const scale = Math.min(1, (mag - DEAD_ZONE) / (1 - DEAD_ZONE)) / mag;
    this.input.axis = { x: x * scale, z: z * scale };
    this.input.forward = z < -DEAD_ZONE;
    this.input.back = z > DEAD_ZONE;
    this.input.left = x < -DEAD_ZONE;
    this.input.right = x > DEAD_ZONE;
    this.input.sprint = mag >= SPRINT_ZONE;
  }

  // ---------------------------------------------------------------- look

  private onLookDown = (e: PointerEvent): void => {
    if (e.clientX < innerWidth / 2 && this.stickPointer === null) {
      e.preventDefault();
      this.stickPointer = e.pointerId;
      this.stickCentre = { x: e.clientX, y: e.clientY };
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('floating', 'active');
      this.moveStick(e.clientX, e.clientY);
      return;
    }
    if (this.lookPointer !== null) return;
    e.preventDefault();
    this.lookPointer = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.lookLast = { x: e.clientX, y: e.clientY };
    this.lookDown = { x: e.clientX, y: e.clientY, at: performance.now() };
  };

  private onLookMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickPointer) return this.moveStick(e.clientX, e.clientY);
    if (e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    const dx = e.clientX - this.lookLast.x;
    const dy = e.clientY - this.lookLast.y;
    this.lookLast = { x: e.clientX, y: e.clientY };
    this.h.onLook(dx * LOOK_GAIN, dy * LOOK_GAIN);
  };

  private onLookUp = (e: PointerEvent): void => {
    if (e.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.setAxis(0, 0);
      this.knob.style.transform = '';
      this.stickBase.classList.remove('active', 'floating');
      return;
    }
    if (e.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
    if (performance.now() - this.lookDown.at <= 250 && Math.hypot(e.clientX - this.lookDown.x, e.clientY - this.lookDown.y) < 12) this.h.onTapWorld?.(e.clientX, e.clientY);
  };

  // ---------------------------------------------------------------- buttons

  private button(def: ButtonDef): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `touch-btn ${def.cls}`;
    b.innerHTML = `<span>${def.label}</span>${def.sub ? `<small>${def.sub}</small>` : ''}`;
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    if (def.hold) {
      const flag = def.hold;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        (this.input as unknown as Record<string, unknown>)[flag] = true;
        b.classList.add('active');
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        (this.input as unknown as Record<string, unknown>)[flag] = false;
        b.classList.remove('active');
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    } else if (def.code === 'KeyE' && this.h.onAttackDown && this.h.onAttackUp) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('active');
        this.h.onAttackDown?.();
      });
      const up = (e: PointerEvent) => {
        e.preventDefault();
        b.classList.remove('active');
        this.h.onAttackUp?.();
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    } else if (def.code === 'TouchRoll') {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('active'); this.h.onRollDown?.(); });
      const up = (e: PointerEvent) => { e.preventDefault(); b.classList.remove('active'); this.h.onRollUp?.(); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    } else if (def.code === 'KeyH') {
      let timer: ReturnType<typeof setTimeout> | null = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('active');
        timer = setTimeout(() => {
          timer = null;
          const items = this.h.onPowerWheel?.() ?? [];
          this.wheel.open(e.clientX, e.clientY, items, (i) => { if (i !== null) this.h.onAction(items[i]!.code); });
        }, POWER_HOLD_MS);
      });
      const up = (cast: boolean) => (e: PointerEvent) => {
        e.preventDefault();
        b.classList.remove('active');
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        if (cast) this.h.onAction('KeyH');
      };
      b.addEventListener('pointerup', up(true));
      b.addEventListener('pointercancel', up(false));
    } else if (def.code === 'TouchBag') {
      let timer: ReturnType<typeof setTimeout> | null = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('active');
        timer = setTimeout(() => {
          timer = null;
          const items = this.h.onBagWheel?.() ?? [];
          this.wheel.open(e.clientX, e.clientY, items, (i) => { if (i !== null) this.h.onAction(items[i]!.code); });
        }, POWER_HOLD_MS);
      });
      const up = (open: boolean) => (e: PointerEvent) => {
        e.preventDefault(); b.classList.remove('active');
        if (!timer) return;
        clearTimeout(timer); timer = null;
        if (open) this.h.onBag?.();
      };
      b.addEventListener('pointerup', up(true)); b.addEventListener('pointercancel', up(false));
    } else if (def.code) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('active');
        this.h.onAction(def.code);
      });
      const up = () => b.classList.remove('active');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
    return b;
  }
}

function div(cls: string): HTMLElement {
  const e = document.createElement('div');
  e.className = cls;
  return e;
}
