export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Render others this far behind server time; 1.5 snapshots at 10 Hz absorbs phone jitter. */
export const INTERP_DELAY = 0.15;

export function lerpAngle(a: number, b: number, k: number): number {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * k;
}

export class InterpBuffer {
  private readonly s: Sample[] = [];

  push(x: Sample): void {
    const last = this.s[this.s.length - 1];
    if (last && x.t <= last.t) return;
    this.s.push(x);
    if (this.s.length > 20) this.s.shift();
  }

  at(t: number): Sample | null {
    const s = this.s;
    const first = s[0];
    if (!first) return null;
    if (t <= first.t) return first;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!;
      const b = s[i]!;
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / (b.t - a.t);
        return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: lerpAngle(a.yaw, b.yaw, k) };
      }
    }
    return s[s.length - 1]!;
  }
}
