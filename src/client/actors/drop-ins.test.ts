import { describe, expect, it } from 'vitest';
import { DROP_INS, dropInClip, isModelResponse } from './drop-ins';

describe('drop-in models', () => {
  it('uses a file only when it really is one', () => {
    expect(isModelResponse(false, 'model/gltf-binary')).toBe(false);
    expect(isModelResponse(true, 'text/html; charset=utf-8')).toBe(false);
    expect(isModelResponse(true, 'model/gltf-binary')).toBe(true);
    expect(isModelResponse(true, 'application/octet-stream')).toBe(true);
  });

  it('lists the spec §9 creatures with a height', () => {
    for (const k of ['deer', 'fish', 'frog', 'whale', 'wolf', 'brute'] as const) expect(DROP_INS[k].height).toBeGreaterThan(0);
  });

  it('finds clips by name, loosely, else the first one', () => {
    expect(dropInClip(['Idle', 'Walk', 'Gallop'], 'gallop')).toBe('Gallop');
    expect(dropInClip(['Deer_Walk', 'Deer_Idle'], 'Idle')).toBe('Deer_Idle');
    expect(dropInClip(['Swim'], 'Run')).toBe('Swim');
    expect(dropInClip([], 'Run')).toBeNull();
  });
});
