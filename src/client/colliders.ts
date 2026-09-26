import type { Circle } from './movement';

/** Uniform grid of circles. Cells must be larger than (largest radius + player radius); 8 m covers rocks (~1.6 m). */
export class ColliderGrid {
  private readonly cells = new Map<string, Map<string, Circle>>();
  private readonly where = new Map<string, string>();

  constructor(private readonly size = 8) {}

  add(key: string, c: Circle): void {
    const ck = this.cell(c.x, c.z);
    let m = this.cells.get(ck);
    if (!m) this.cells.set(ck, (m = new Map()));
    m.set(key, c);
    this.where.set(key, ck);
  }

  remove(key: string): void {
    const ck = this.where.get(key);
    if (!ck) return;
    this.cells.get(ck)?.delete(key);
    this.where.delete(key);
  }

  near(x: number, z: number): Circle[] {
    const out: Circle[] = [];
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const m = this.cells.get(`${cx + dx}:${cz + dz}`);
        if (m) out.push(...m.values());
      }
    }
    return out;
  }

  private cell(x: number, z: number): string {
    return `${Math.floor(x / this.size)}:${Math.floor(z / this.size)}`;
  }
}
