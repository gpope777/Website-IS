import { describe, expect, it } from 'vitest';
import { KEY_ACTIONS } from './input';
import { nextTrap, TRAP_LABEL } from './trap';

describe('traps', () => {
  it('T places spikes, Y the red de raíces, the touch pill the selected one', () => {
    expect(KEY_ACTIONS.KeyT).toBe('spikes');
    expect(KEY_ACTIONS.KeyY).toBe('net');
    expect(KEY_ACTIONS.TouchTrap).toBe('trap');
  });

  it('the Menú toggle cycles between the two', () => {
    expect(nextTrap('spikes')).toBe('roots');
    expect(nextTrap('roots')).toBe('spikes');
    expect(TRAP_LABEL.roots).toBe('red de raíces');
  });

  it('with Fuego the hoguera joins the cycle; U places it (S3-E)', () => {
    expect(KEY_ACTIONS.KeyU).toBe('fire');
    expect(nextTrap('roots', true)).toBe('fire');
    expect(nextTrap('fire', true)).toBe('spikes');
    expect(nextTrap('fire')).toBe('spikes');
    expect(TRAP_LABEL.fire).toBe('hoguera');
  });
});
