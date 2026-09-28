import type { MoveInput } from './movement';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  /** Held guard (Z / 🛡️). */
  block: boolean;
  /** Touch stick: x = strafe, z = forward(-)/back(+), magnitude ≤ 1. */
  axis?: { x: number; z: number };
}

export function readMove(i: InputState): MoveInput {
  if (i.axis) return { x: i.axis.x, z: i.axis.z, sprint: i.sprint, jump: i.jump };
  return { x: (i.right ? 1 : 0) - (i.left ? 1 : 0), z: (i.back ? 1 : 0) - (i.forward ? 1 : 0), sprint: i.sprint, jump: i.jump };
}

export type Action = 'act' | 'eat' | 'campfire' | 'wall' | 'heart' | 'spikes' | 'net' | 'trap' | 'camera' | 'menu' | 'roll' | 'bow' | 'lock' | 'power' | 'switch' | 'mount' | 'dismiss' | 'fire' | 'tower' | 'mute';

/** Also used by touch buttons, which fire these KeyboardEvent codes. */
export const KEY_ACTIONS: Record<string, Action> = {
  KeyE: 'act',
  KeyF: 'act',
  Digit1: 'eat',
  KeyB: 'campfire',
  KeyV: 'wall',
  KeyG: 'heart',
  KeyT: 'spikes',
  KeyY: 'net',
  /** Hoguera (needs Fuego). */
  KeyU: 'fire',
  /** Torre (needs Piedra). */
  KeyI: 'tower',
  /** Touch pill only: places the trap chosen in the Menú. */
  TouchTrap: 'trap',
  KeyC: 'camera',
  KeyQ: 'roll',
  KeyR: 'bow',
  KeyX: 'lock',
  KeyH: 'power',
  KeyJ: 'switch',
  /** Touch only: holding the power pill 0.5 s switches powers. */
  TouchSwitch: 'switch',
  KeyM: 'mount',
  Escape: 'menu',
  Enter: 'dismiss',
  /** P7-B: Silencio (M is already mount). */
  Period: 'mute',
};

const HOLD: Record<string, keyof Omit<InputState, 'axis'>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  KeyZ: 'block',
};

/** Zero every held movement/action flag, e.g. on blur or when an overlay (menu/death) takes over input. */
export function clearHold(input: InputState): void {
  for (const k of Object.values(HOLD)) input[k] = false;
}

export class Keyboard {
  constructor(private readonly input: InputState, private readonly onAction: (a: Action) => void) {
    addEventListener('keydown', this.down);
    addEventListener('keyup', this.up);
    addEventListener('blur', this.clear);
  }

  dispose(): void {
    removeEventListener('keydown', this.down);
    removeEventListener('keyup', this.up);
    removeEventListener('blur', this.clear);
  }

  private down = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    const hold = HOLD[e.code];
    if (hold) {
      this.input[hold] = true;
      e.preventDefault();
      return;
    }
    const action = KEY_ACTIONS[e.code];
    if (action && !e.repeat) this.onAction(action);
  };

  private up = (e: KeyboardEvent): void => {
    const hold = HOLD[e.code];
    if (hold) this.input[hold] = false;
  };

  private clear = (): void => clearHold(this.input);
}

/** The powers in switching order, and their pill icons. */
export const POWER_ORDER = ['enredadera', 'viento', 'fuego', 'piedra'] as const;
export type PowerChoice = (typeof POWER_ORDER)[number];
export const POWER_ICON: Record<PowerChoice, string> = { enredadera: '🌿', viento: '🌬️', fuego: '🔥', piedra: '🪨' };

/** The next owned power after `cur` (itself when it is the only one). */
export function nextPower(cur: PowerChoice, owns: Partial<Record<PowerChoice, boolean>>): PowerChoice {
  const i = POWER_ORDER.indexOf(cur);
  for (let k = 1; k <= POWER_ORDER.length; k++) {
    const p = POWER_ORDER[(i + k) % POWER_ORDER.length]!;
    if (owns[p]) return p;
  }
  return cur;
}
