import { describe, expect, it } from 'vitest';
import { Combo } from './combo';

const tap = (c: Combo, t: number) => { c.press(t); return c.release(t + 0.05); };

describe('Combo', () => {
  it('encadena 1-2-3-1 y reinicia fuera de la ventana', () => {
    const c = new Combo(0.6, 0.8, 4);
    expect(tap(c, 0)).toEqual({ kind: 'swing', step: 1 });
    expect(tap(c, 0.7)).toEqual({ kind: 'swing', step: 2 });
    expect(tap(c, 1.4)).toEqual({ kind: 'swing', step: 3 });
    expect(tap(c, 2.1)).toEqual({ kind: 'swing', step: 1 });
    expect(tap(c, 3.3)).toEqual({ kind: 'swing', step: 1 });
  });

  it('guarda un solo toque temprano hasta acabar el enfriamiento', () => {
    const c = new Combo(0.6, 0.8, 4);
    tap(c, 0);
    expect(tap(c, 0.2)).toBeNull();
    expect(tap(c, 0.3)).toBeNull();
    expect(c.tick(0.6)).toBeNull();
    expect(c.tick(0.65)).toEqual({ kind: 'swing', step: 2 });
    expect(c.tick(0.7)).toBeNull();
  });

  it('mantener carga el giratorio y reinicia el combo', () => {
    const c = new Combo(0.6, 0.8, 4);
    c.press(0);
    expect(c.charge(0.4)).toBeCloseTo(0.5);
    expect(c.release(0.85)).toEqual({ kind: 'spin' });
    c.press(1);
    expect(c.release(1.5)).toEqual({ kind: 'swing', step: 1 });
  });

  it('durante el enfriamiento del giratorio un hold es golpe normal', () => {
    const c = new Combo(0.6, 0.8, 4);
    c.press(0); c.release(0.9);
    c.press(1.6);
    expect(c.release(2.5)).toEqual({ kind: 'swing', step: 1 });
    c.press(5);
    expect(c.release(5.9)).toEqual({ kind: 'spin' });
  });

  it('ignora una liberación sin presión previa', () => {
    expect(new Combo(0.6, 0.8, 4).release(1)).toBeNull();
  });
});
