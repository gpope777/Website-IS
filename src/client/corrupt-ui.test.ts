import { describe, expect, it } from 'vitest';
import { pillarSites } from '../shared/pillars';
import type { PillarView } from '../shared/protocol';
import { pillarAction } from './corrupt-ui';

const S = pillarSites(42);
const view = (o: Partial<PillarView> = {}): PillarView => ({ broken: [false, false, false, false], roots: [false, false, false], anchor: false, miasma: 0, burns: 0, lid: false, ...o });

describe('pillarAction (S5-C)', () => {
  it('offers "Arrancar el núcleo" beside a standing core', () => {
    const c = S.cores[2]!;
    expect(pillarAction({ x: c.x + 1, z: c.z }, S, view())).toEqual({ id: 2, label: 'Arrancar el núcleo' });
  });
  it('nothing when broken, far, before the snapshot, or while the Viento core is still on the lake bed', () => {
    const c = S.cores[2]!;
    expect(pillarAction({ x: c.x + 1, z: c.z }, S, view({ broken: [false, false, true, false] }))).toBeNull();
    expect(pillarAction({ x: c.x + 5, z: c.z }, S, view())).toBeNull();
    expect(pillarAction({ x: c.x, z: c.z }, S, null)).toBeNull();
    const w = S.cores[1]!;
    expect(pillarAction(w, S, view({ anchor: true }))).toBeNull();
    expect(pillarAction(w, S, view())?.id).toBe(1);
  });
});
