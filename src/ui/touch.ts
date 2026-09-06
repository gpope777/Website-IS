import type { InputState } from '../game/player';

/** True on phones/tablets: coarse pointer without hover. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
}

export interface TouchHandlers {
  /** Camera look delta in "mouse pixels". */
  onLook: (dx: number, dy: number) => void;
  /** A momentary action, expressed as a KeyboardEvent.code so it shares the keyboard path. */
  onAction: (code: string) => void;
  onPause: () => void;
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
  { code: 'KeyE', label: 'A', sub: 'usar', cls: 'btn-a' },
  { code: 'Space', label: 'B', sub: 'saltar', cls: 'btn-b', hold: 'jump' },
];

const PILL_BUTTONS: ButtonDef[] = [
  { code: 'Digit1', label: '1', sub: '🫐', cls: 'pill' },
  { code: 'Digit2', label: '2', sub: '🍄', cls: 'pill' },
  { code: 'Digit3', label: '3', sub: '💧', cls: 'pill' },
  { code: 'KeyT', label: 'T', sub: '🔦', cls: 'pill' },
  { code: 'KeyF', label: 'F', sub: '🔥', cls: 'pill' },
  { code: 'KeyR', label: 'R', sub: '⛺', cls: 'pill' },
];

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
  private readonly stickBase: HTMLElement;
  private readonly knob: HTMLElement;
  private stickCentre = { x: 0, y: 0 };

  constructor(parent: HTMLElement, private readonly input: InputState, private readonly h: TouchHandlers) {
    this.root = div('touch-layer');
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
    for (const b of ACTION_BUTTONS) actions.appendChild(this.button(b));

    const pills = div('touch-pills');
    for (const b of PILL_BUTTONS) pills.appendChild(this.button(b));

    const system = div('touch-system');
    system.appendChild(this.button({ code: 'KeyC', label: 'CREAR', cls: 'sys' }));
    const pause = this.button({ code: '', label: 'PAUSA', cls: 'sys' });
    pause.addEventListener('pointerup', (e) => {
      e.preventDefault();
      h.onPause();
    });
    system.appendChild(pause);

    this.root.append(look, this.stickBase, actions, pills, system);
  }

  /** Clear every held flag, e.g. when the game pauses or a menu opens. */
  release(): void {
    this.stickPointer = null;
    this.lookPointer = null;
    this.setAxis(0, 0);
    this.input.jump = false;
    this.knob.style.transform = '';
    this.stickBase.classList.remove('active');
  }

  dispose(): void {
    this.release();
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
    if (this.lookPointer !== null) return;
    e.preventDefault();
    this.lookPointer = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.lookLast = { x: e.clientX, y: e.clientY };
  };

  private onLookMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    const dx = e.clientX - this.lookLast.x;
    const dy = e.clientY - this.lookLast.y;
    this.lookLast = { x: e.clientX, y: e.clientY };
    this.h.onLook(dx * LOOK_GAIN, dy * LOOK_GAIN);
  };

  private onLookUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
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
