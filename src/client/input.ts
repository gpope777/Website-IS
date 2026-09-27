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

export type Action = 'act' | 'eat' | 'campfire' | 'wall' | 'heart' | 'spikes' | 'camera' | 'menu' | 'roll' | 'bow' | 'lock' | 'power' | 'mount';

/** Also used by touch buttons, which fire these KeyboardEvent codes. */
export const KEY_ACTIONS: Record<string, Action> = {
  KeyE: 'act',
  KeyF: 'act',
  Digit1: 'eat',
  KeyB: 'campfire',
  KeyV: 'wall',
  KeyG: 'heart',
  KeyT: 'spikes',
  KeyC: 'camera',
  KeyQ: 'roll',
  KeyR: 'bow',
  KeyX: 'lock',
  KeyH: 'power',
  KeyM: 'mount',
  Escape: 'menu',
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
