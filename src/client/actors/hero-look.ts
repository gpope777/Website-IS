export const SKINS: readonly number[] = [-1, 0xf1c9a5, 0xd9a07a, 0xa86b45, 0x6e4128];

export function heroTextureKey(body: number, color: number, skin: number): string {
  return `${body}:${color}:${skin}`;
}

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Repaint selected atlas cells in place while retaining each pixel's brightness relative to its cell. */
export function recolor(px: Uint8ClampedArray, w: number, h: number, cells: readonly [number, number][], grid: { cols: number; rows: number }, target: number): void {
  const [tr, tg, tb] = rgb(target);
  for (const [col, row] of cells) {
    const x0 = Math.floor((col * w) / grid.cols);
    const x1 = Math.floor(((col + 1) * w) / grid.cols);
    const y0 = Math.floor((row * h) / grid.rows);
    const y1 = Math.floor(((row + 1) * h) / grid.rows);
    let total = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3]! === 0) continue;
      total += lum(px[i]!, px[i + 1]!, px[i + 2]!);
      count++;
    }
    const mean = count ? total / count : 1;
    const targetLum = Math.max(1, lum(tr, tg, tb));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3]! === 0) continue;
      const k = lum(px[i]!, px[i + 1]!, px[i + 2]!) / mean;
      const normalize = mean / targetLum;
      px[i] = Math.min(255, Math.round(tr * k * normalize));
      px[i + 1] = Math.min(255, Math.round(tg * k * normalize));
      px[i + 2] = Math.min(255, Math.round(tb * k * normalize));
    }
  }
}
