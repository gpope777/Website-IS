import type { Zone } from '../../shared/corruption';

/**
 * V2-C Idea de Claude (spec §11): the world heals where you can see it. A zone cleansed while you watch
 * heals as a wave from its root (the front grows to r + 4 in 20 s); when El Marchito falls every zone
 * left waves at once and las Tierras turn Purified over 60 s. What was already clean on arrival is clean.
 */
export const HEAL = { secs: 20, pad: 4, band: 2.5, purifySecs: 60 } as const;

/** Front value meaning "fully corrupt" / "fully healed" in the shader's `zones[i].w`. */
export const FRONT_CORRUPT = -1;
export const FRONT_HEALED = 1e5;

export class HealWaves {
  private readonly started = new Map<number, number>();
  private readonly corrupt = new Set<number>();
  private first = true;
  private ending = false;
  private purifyAt: number | null = null;

  /** Feed the latest corrupt ids and the ending flag (`now` in seconds). */
  sync(corrupt: readonly number[], ending: boolean, now: number): void {
    const next = new Set(corrupt);
    if (!this.first) {
      for (const id of this.corrupt) if (!next.has(id)) this.started.set(id, now);
      if (ending && !this.ending) this.purifyAt = now;
    } else if (ending) this.purifyAt = -Infinity;
    for (const id of next) this.started.delete(id);
    if (!ending) this.purifyAt = null;
    this.corrupt.clear();
    for (const id of next) this.corrupt.add(id);
    this.ending = ending;
    this.first = false;
  }

  /** The heal front (m from the zone's centre) for the shader: corrupt beyond it. */
  front(zone: Zone, now: number): number {
    if (this.corrupt.has(zone.id)) return FRONT_CORRUPT;
    const s = this.started.get(zone.id);
    if (s === undefined) return FRONT_HEALED;
    const k = (now - s) / HEAL.secs;
    if (k >= 1) {
      this.started.delete(zone.id);
      return FRONT_HEALED;
    }
    return Math.max(0, k) * (zone.r + HEAL.pad);
  }

  /** 0..1: how purified las Tierras look (1 at once if El Marchito had already fallen when we arrived). */
  purify(now: number): number {
    if (this.purifyAt === null) return 0;
    return Math.min(1, Math.max(0, (now - this.purifyAt) / HEAL.purifySecs));
  }

  /** Any wave still running (the caller may skip uniform uploads otherwise). */
  get busy(): boolean {
    return this.started.size > 0;
  }
}
