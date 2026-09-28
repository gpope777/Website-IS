import { describe, expect, it } from 'vitest';
import { bearing, edgeArrow, GUIDE, lineText, nextStep, STORY, type GuideView, type Places } from './guide';

const P = (x: number, z: number) => ({ x, z });
const places: Places = {
  shrines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((id) => ({ id, x: id * 10, z: 100 })),
  forestDoor: P(1, 1),
  coastDoor: P(2, 2),
  swampDoor: P(3, 3),
  mountainDoor: P(4, 4),
  deer: P(5, 5),
  fish: P(6, 6),
  frog: P(7, 7),
  whale: P(8, 8),
  pico: P(9, 9),
  cage: P(10, 10),
  knot: P(11, 11),
  umbral: P(12, 12),
  rim: P(13, 13),
  ceniza: P(14, 14),
  pillars: [P(100, 0), P(200, 0), P(300, 0), P(400, 0)],
  tower: P(15, 15),
  estrella: P(16, 16),
};

function fresh(): GuideView {
  return {
    touch: true,
    me: P(0, 0),
    self: { orbs: [], vine: false, wind: false, fire: false, stone: false, deer: false, fish: false, frog: false, dragon: false, star: false, skillPts: 0 },
    world: { heart: null, story: { inv: [0, 0, 0], bosses: [false, false, false, false] }, whale: false, zarzal: false, escalera: false, fog: 'closed', pillars: [false, false, false, false], ceniza: false, towerOpen: false, ending: false, zones: [], fullMoon: false },
    friends: [],
    places,
  };
}

type Mut = (v: GuideView) => void;
const orbs = (ids: number[]): Mut => (v) => void (v.self = { ...v.self, orbs: [...v.self.orbs, ...ids] });
const self = (o: Partial<GuideView['self']>): Mut => (v) => void (v.self = { ...v.self, ...o });
const world = (o: Partial<GuideView['world']>): Mut => (v) => void (v.world = { ...v.world, ...o });
const boss = (i: number): Mut => (v) => {
  const b = [...v.world.story.bosses] as GuideView['world']['story']['bosses'];
  b[i] = true;
  v.world = { ...v.world, story: { ...v.world.story, bosses: b } };
};
const inv = (i: number, n: number): Mut => (v) => {
  const a = [...v.world.story.inv] as GuideView['world']['story']['inv'];
  a[i] = n;
  v.world = { ...v.world, story: { ...v.world.story, inv: a } };
};

/** The whole story, new world → credits → la Estrella, as the save would change. World steps first in `WORLD`. */
const WALK: [string, Mut][] = [
  ['heart', world({ heart: P(0, 0) })],
  ['shrines-forest', orbs([0, 1, 2])],
  ['boss-forest', (v) => (boss(0)(v), inv(0, 1)(v))],
  ['vine', self({ vine: true })],
  ['deer', self({ deer: true })],
  ['invasion1', inv(0, 2)],
  ['fish', (v) => (self({ fish: true })(v), v.world.story.inv[1] === 0 && inv(1, 1)(v))],
  ['shrines-coast', orbs([3, 4, 5])],
  ['invasion2', inv(1, 3)],
  ['whale', world({ whale: true })],
  ['wind', self({ wind: true })],
  ['boss-coast', boss(1)],
  ['frog', self({ frog: true })],
  ['shrines-swamp', orbs([6, 7, 8])],
  ['fire', self({ fire: true })],
  ['boss-swamp', boss(2)],
  ['knot', world({ zarzal: true })],
  ['shrines-mountain', orbs([9, 10, 11])],
  ['stone', self({ stone: true })],
  ['boss-mountain', boss(3)],
  ['escalera', world({ escalera: true })],
  ['dragon', self({ dragon: true })],
  ['fog', world({ fog: 'open' })],
  ['ceniza', world({ ceniza: true })],
  ['pillars', (v) => (world({ pillars: [true, true, true, true] })(v), inv(2, 1)(v))],
  ['invasion3', (v) => (inv(2, 2)(v), world({ towerOpen: true })(v))],
  ['tower', world({ ending: true })],
  ['star', self({ star: true })],
];

describe('guide: nextStep', () => {
  it('walks a whole save from a new world to the credits and la Estrella, in order', () => {
    const v = fresh();
    const seen: string[] = [];
    for (const [id, done] of WALK) {
      const s = nextStep(v);
      seen.push(s?.id ?? 'null');
      expect(s?.id, `before ${id}`).toBe(id);
      expect(s!.text).not.toContain('!');
      done(v);
    }
    expect(seen).toEqual(STORY.map((s) => s.id));
    expect(STORY.length).toBeGreaterThanOrEqual(28);
    expect(nextStep(v)).toBeNull();
  });

  it('marks world and player steps as the spec says', () => {
    const scope = Object.fromEntries(STORY.map((s) => [s.id, s.scope]));
    for (const id of ['vine', 'deer', 'fish', 'wind', 'frog', 'fire', 'stone', 'dragon', 'star', 'shrines-forest', 'shrines-coast', 'shrines-swamp', 'shrines-mountain']) expect(scope[id]).toBe('player');
    for (const id of ['heart', 'boss-forest', 'invasion1', 'invasion2', 'whale', 'boss-coast', 'boss-swamp', 'knot', 'boss-mountain', 'escalera', 'fog', 'ceniza', 'pillars', 'invasion3', 'tower']) expect(scope[id]).toBe('world');
  });

  it('co-op: a newcomer in a finished world only gets player steps', () => {
    const v = fresh();
    for (const [id, done] of WALK) if (STORY.find((s) => s.id === id)!.scope === 'world') done(v);
    const got: string[] = [];
    for (let i = 0; i < 20; i++) {
      const s = nextStep(v);
      if (!s) break;
      got.push(s.id);
      expect(s.scope).toBe('player');
      WALK.find(([id]) => id === s.id)![1](v);
    }
    expect(got[0]).toBe('shrines-forest');
    expect(got).toEqual(STORY.filter((s) => s.scope === 'player').map((s) => s.id));
  });

  it("a friend's mount is not yours", () => {
    const v = fresh();
    for (const [id, done] of WALK.slice(0, 4)) done(v), void id;
    v.friends = [{ name: 'Bea', x: 5, z: 5 }];
    expect(nextStep(v)!.id).toBe('deer');
  });

  it('targets the nearest missing shrine and pillar, and the door for a dungeon', () => {
    const v = fresh();
    WALK[0]![1](v);
    v.me = P(20, 100);
    expect(nextStep(v)!.target).toEqual(P(20, 100));
    orbs([2])(v);
    expect(nextStep(v)!.target).toEqual(P(10, 100));
    orbs([0, 1])(v);
    expect(nextStep(v)!.target).toEqual(places.forestDoor);
    for (const [id, done] of WALK.slice(2)) {
      if (id === 'pillars') break;
      done(v);
    }
    v.me = P(290, 0);
    world({ pillars: [true, false, false, false] })(v);
    const s = nextStep(v)!;
    expect(s.id).toBe('pillars');
    expect(s.target).toEqual(P(300, 0));
    expect(s.text).toContain('1/4');
  });

  it('Invasion 2 reads by state', () => {
    const v = fresh();
    for (const [id, done] of WALK) {
      if (id === 'invasion2') break;
      done(v);
    }
    expect(nextStep(v)!.target).toEqual(P(0, 0));
    inv(1, 2)(v);
    expect(nextStep(v)!.target).toEqual(places.cage);
    expect(nextStep(v)!.text).toContain('jaula');
  });

  it('secondaries: oficio points when the story is over, a close zone when the story is far', () => {
    const v = fresh();
    for (const [, done] of WALK) done(v);
    v.self = { ...v.self, skillPts: 2 };
    expect(nextStep(v)!.text).toBe('Tienes 2 puntos de oficio (Menú › Libro)');
    v.self = { ...v.self, skillPts: 0 };
    v.world = { ...v.world, zones: [P(50, 0)] };
    expect(nextStep(v)!.id).toBe('zone');
    v.world = { ...v.world, zones: [P(500, 0)] };
    expect(nextStep(v)).toBeNull();

    const w = fresh();
    WALK[0]![1](w);
    w.me = P(0, -1000);
    w.world = { ...w.world, zones: [P(0, -1050)] };
    expect(nextStep(w)!.id).toBe('zone');
    w.me = P(0, 50);
    expect(nextStep(w)!.id).toBe('shrines-forest');
  });

  it('full moon only after the ending and before la Estrella', () => {
    const v = fresh();
    for (const [id, done] of WALK) if (id !== 'star') done(v);
    v.world = { ...v.world, fullMoon: true };
    expect(nextStep(v)!.id).toBe('star');
  });
});

describe('guide: line, bearing, edge arrow', () => {
  it('line text: here, metres + arrow, friend note, device key', () => {
    const v = fresh();
    expect(lineText(nextStep(v)!, v, 0)).toBe('🌳 Planta el Corazón del Bosque (🌳)');
    expect(lineText(nextStep({ ...v, touch: false })!, { ...v, touch: false }, 0)).toContain('(G)');
    WALK[0]![1](v);
    v.me = P(0, 220);
    // yaw 0 looks toward −Z; shrine 0 is at (0, 100): straight ahead.
    expect(lineText(nextStep(v)!, v, 0)).toBe('✨ Santuario del Bosque · 120 m ↑');
    v.friends = [{ name: 'Bea', x: 3, z: 104 }];
    expect(lineText(nextStep(v)!, v, 0)).toContain('(Bea está allí)');
    v.me = P(0, 100 + GUIDE.here - 1);
    expect(lineText(nextStep(v)!, v, 0)).toContain('· aquí');
  });

  it('bearing: 8 arrows around the camera', () => {
    const me = P(0, 0);
    expect(bearing(me, 0, P(0, -10)).arrow).toBe('↑');
    expect(bearing(me, 0, P(10, 0)).arrow).toBe('→');
    expect(bearing(me, 0, P(0, 10)).arrow).toBe('↓');
    expect(bearing(me, 0, P(-10, 0)).arrow).toBe('←');
    expect(bearing(me, 0, P(10, -10)).arrow).toBe('↗');
    expect(bearing(me, Math.PI / 2, P(-10, 0)).arrow).toBe('↑');
    expect(bearing(me, 0, P(3, -4)).m).toBe(5);
  });

  it('edge arrow: none on screen, clamped to the padded edge, behind goes to the bottom', () => {
    expect(edgeArrow(0.2, -0.3, false, 400, 800, 24)).toBeNull();
    const r = edgeArrow(3, 0, false, 400, 800, 24)!;
    expect(r.x).toBeCloseTo(400 - 24);
    expect(r.y).toBeCloseTo(400);
    expect(r.deg).toBeCloseTo(90);
    const up = edgeArrow(0, 5, false, 400, 800, 24)!;
    expect(up.y).toBeCloseTo(24);
    expect(up.deg).toBeCloseTo(0);
    const back = edgeArrow(0, 0.1, true, 400, 800, 24)!;
    expect(back.y).toBeCloseTo(800 - 24);
    expect(Math.abs(back.deg)).toBeCloseTo(180);
    for (const [x, y, b] of [[5, 5, false], [-3, 0.5, true], [0.4, -9, false]] as const) {
      const a = edgeArrow(x, y, b, 390, 844, 24)!;
      expect(a.x).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(a.x).toBeLessThanOrEqual(390 - 24 + 1e-9);
      expect(a.y).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(a.y).toBeLessThanOrEqual(844 - 24 + 1e-9);
    }
  });
});
