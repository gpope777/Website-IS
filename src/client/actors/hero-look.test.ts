import { describe, expect, it } from 'vitest';
import { heroTextureKey, recolor, SKINS } from './hero-look';

const grid = { cols: 2, rows: 1 };
function img() {
  const px = new Uint8ClampedArray(4 * 2 * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => px.set([r, g, b, 255], (y * 4 + x) * 4);
  set(0, 0, 40, 60, 160); set(1, 0, 40, 60, 160); set(0, 1, 80, 120, 220); set(1, 1, 80, 120, 220);
  for (const [x, y] of [[2, 0], [3, 0], [2, 1], [3, 1]]) set(x!, y!, 128, 128, 128);
  return px;
}

describe('hero recolor', () => {
  it('repinta solo las celdas pedidas y conserva el gradiente', () => {
    const px = img();
    recolor(px, 4, 2, [[0, 0]], grid, 0xc84040);
    const top = [...px.slice(0, 3)];
    const bottom = [...px.slice(16, 19)];
    expect(top[0]!).toBeGreaterThan(top[2]!);
    expect(bottom[0]!).toBeGreaterThan(top[0]!);
    expect([...px.slice(8, 11)]).toEqual([128, 128, 128]);
  });
  it('ofrece cinco pieles y claves estables', () => {
    expect(SKINS).toHaveLength(5);
    expect(SKINS[0]).toBe(-1);
    expect(heroTextureKey(2, 3, 4)).toBe('2:3:4');
  });
});
