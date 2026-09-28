import { describe, expect, it } from 'vitest';
import { ambienceGains, busGains, dominant, jitter, musicTrack, spatial, surface, Unlock, Voices } from './mix';
import { actionCue, CueTracker, sendCue, toastCue, type SnapLike } from './cues';
import { defaultSettings, parseSettings } from '../settings';

describe('Voices', () => {
  it('cuts the oldest of the same class at 12, else the oldest; never a tell', () => {
    const v = new Voices();
    v.start(0, 'tell', true, 0);
    for (let i = 1; i < 11; i++) v.start(i, 'world', false, i);
    v.start(11, 'step', false, 11);
    expect(v.size).toBe(12);
    expect(v.start(12, 'step', false, 12)).toBe(11);
    expect(v.start(13, 'ui', false, 13)).toBe(1);
    expect(v.size).toBe(12);
    v.end(13);
    expect(v.size).toBe(11);
  });
  it('a full list of tells cuts nothing', () => {
    const v = new Voices();
    for (let i = 0; i < 12; i++) v.start(i, 'tell', true, i);
    expect(v.start(99, 'tell', true, 99)).toBeNull();
  });
});

describe('spatial', () => {
  it('attenuates to 0 at 40 m', () => {
    expect(spatial(0, 0, 0, 0, 0, false).gain).toBe(1);
    expect(spatial(0, 0, 0, 0, -20, false).gain).toBeCloseTo(0.25);
    expect(spatial(0, 0, 0, 0, -40, false).gain).toBe(0);
  });
  it('tells stay audible off-screen and far', () => {
    expect(spatial(0, 0, 0, 0, 50, true).gain).toBe(0.5);
    expect(spatial(0, 0, 0, 0, 90, true).gain).toBe(0.3);
  });
  it('pans right when the source is to the camera right (yaw 0 looks −Z)', () => {
    expect(spatial(0, 0, 0, 10, 0, false).pan).toBeCloseTo(0.8);
    expect(spatial(0, 0, 0, -10, 0, false).pan).toBeCloseTo(-0.8);
    expect(spatial(0, 0, 0, 0, -10, false).pan).toBeCloseTo(0);
    // turned 90° left (yaw +π/2 looks −X): +Z is now on the right
    expect(spatial(0, 0, Math.PI / 2, 0, -10, false).pan).toBeCloseTo(0.8);
  });
  it('jitter is ±6 %', () => {
    expect(jitter(0)).toBeCloseTo(0.94);
    expect(jitter(0.5)).toBeCloseTo(1);
    expect(jitter(0.9999)).toBeLessThanOrEqual(1.06);
  });
});

describe('busGains + settings', () => {
  it('perceptual, mute and hidden', () => {
    const s = { ...defaultSettings(false), master: 50 };
    expect(busGains(s, false).master).toBeCloseTo(0.25);
    expect(busGains({ ...s, mute: true }, false).master).toBe(0);
    expect(busGains(s, true).master).toBe(0);
    expect(busGains({ ...s, amb: 100 }, false).ambient).toBe(1);
  });
  it('parseSettings clamps volumes and keeps the old fields', () => {
    const s = parseSettings('{"shake":"nada","master":150,"sfx":-3,"amb":"x","mute":true}', false);
    expect(s).toMatchObject({ shake: 'nada', master: 100, sfx: 0, amb: 60, music: 60, mute: true });
    expect(parseSettings(null, true)).toMatchObject({ master: 80, mute: false });
  });
});

describe('ambience', () => {
  const o = { day: true, height: 0, rain: false, storm: false, ending: false };
  it('forest day has leaves, night crickets', () => {
    const d = ambienceGains({ bosque: 1 }, o);
    expect(d.hojas).toBeGreaterThan(0);
    expect(d.grillos).toBe(0);
    const n = ambienceGains({ bosque: 1 }, { ...o, day: false });
    expect(n.hojas).toBe(0);
    expect(n.grillos).toBeGreaterThan(0);
  });
  it('mountain wind grows with height and storm; rain layer', () => {
    expect(ambienceGains({ montanas: 1 }, { ...o, height: 100 }).viento).toBeGreaterThan(ambienceGains({ montanas: 1 }, o).viento);
    expect(ambienceGains({ montanas: 1 }, { ...o, storm: true }).viento).toBeGreaterThan(ambienceGains({ montanas: 1 }, o).viento);
    expect(ambienceGains({ bosque: 1 }, { ...o, rain: true }).lluvia).toBeGreaterThan(0);
  });
  it('tierras hums until the ending, then sounds like the forest', () => {
    expect(ambienceGains({ tierras: 1 }, o).grave).toBeGreaterThan(0);
    const e = ambienceGains({ tierras: 1 }, { ...o, ending: true });
    expect(e.grave).toBe(0);
    expect(e.hojas).toBeGreaterThan(0);
  });
  it('crossfades by weight', () => {
    const g = ambienceGains({ bosque: 0.5, costa: 0.5 }, o);
    expect(g.olas).toBeCloseTo(0.4);
    expect(g.hojas).toBeCloseTo(0.3);
    expect(dominant({ bosque: 0.4, costa: 0.6 })).toBe('costa');
  });
});

describe('music and unlock', () => {
  it('drop-ins: none → silence; jefe > asedio > bioma', () => {
    expect(musicTrack(new Set(), { biome: 'bosque', raid: true, boss: true })).toBeNull();
    const all = new Set(['bosque', 'asedio', 'jefe']);
    expect(musicTrack(all, { biome: 'bosque', raid: true, boss: true })).toBe('jefe');
    expect(musicTrack(all, { biome: 'bosque', raid: true, boss: false })).toBe('asedio');
    expect(musicTrack(all, { biome: 'costa', raid: false, boss: false })).toBeNull();
    expect(musicTrack(all, { biome: 'bosque', raid: false, boss: false })).toBe('bosque');
  });
  it('warns once after 2 suspended gestures', () => {
    const u = new Unlock();
    expect(u.gesture(false)).toBeNull();
    expect(u.gesture(false)).toBe('warn');
    expect(u.gesture(false)).toBeNull();
    expect(u.gesture(true)).toBe('ok');
  });
  it('surface', () => {
    expect(surface('costa', 1, false)).toBe('arena');
    expect(surface('costa', 10, false)).toBe('hierba');
    expect(surface('montanas', 80, false)).toBe('nieve');
    expect(surface('montanas', 20, false)).toBe('roca');
    expect(surface('bosque', 0, true)).toBe('agua');
  });
});

describe('CueTracker', () => {
  const base = (p: Partial<SnapLike> = {}): SnapLike => ({ wolves: [], self: { dead: false, vitals: { health: 100 } }, raid: null, marchito: null, ...p });
  it('blows: mine unpositioned, a friend’s at the enemy', () => {
    const t = new CueTracker();
    const wolves = [{ id: 1, kind: 'wolf' as const, x: 5, z: 6, anim: 'idle' as const }];
    const c = t.snap(base({ wolves, fx: [{ id: 1, dmg: 5, kind: 'hit', by: 'Ana' }, { id: 1, dmg: 5, kind: 'kill', by: 'Bea' }, { id: 1, dmg: 0, kind: 'parry', by: 'Ana' }, { id: 1, dmg: 2, kind: 'block', by: 'Ana' }] }), 'Ana', 0);
    expect(c).toEqual([{ id: 'golpe' }, { id: 'golpe-final', x: 5, z: 6 }, { id: 'parada' }, { id: 'bloqueo' }]);
  });
  it('hurt', () => {
    expect(new CueTracker().snap(base({ self: { hurt: 4, dead: false, vitals: { health: 90 } } }), 'Ana', 0)).toEqual([{ id: 'dano' }]);
  });
  it('a wind-up sounds once, on the transition to attack', () => {
    const t = new CueTracker();
    const w = (anim: 'idle' | 'attack', kind: 'wolf' | 'boss3' = 'wolf') => base({ wolves: [{ id: 2, kind, x: 1, z: 2, anim }] });
    expect(t.snap(w('attack'), 'Ana', 0)).toEqual([]); // first sighting: no transition known
    expect(t.snap(w('idle'), 'Ana', 0)).toEqual([]);
    expect(t.snap(w('attack'), 'Ana', 0)).toEqual([{ id: 'lobo-aviso', x: 1, z: 2 }]);
    expect(t.snap(w('attack'), 'Ana', 0)).toEqual([]);
    t.snap(w('idle', 'boss3'), 'Ana', 0);
    expect(t.snap(w('attack', 'boss3'), 'Ana', 0)).toEqual([{ id: 'jefe-aviso', x: 1, z: 2 }]);
  });
  it('dungeon tells, raid horn, the laugh: once each', () => {
    const t = new CueTracker();
    expect(t.snap(base({ tells: ['coast:sweep'], raid: { phase: 'warn' }, marchito: { laughing: true } }), 'Ana', 0).map((c) => c.id)).toEqual(['jefe-aviso', 'cuerno', 'marchito']);
    expect(t.snap(base({ tells: ['coast:sweep'], raid: { phase: 'warn' }, marchito: { laughing: true } }), 'Ana', 0)).toEqual([]);
  });
  it('heartbeat under 25 % every 1.1 s, never when dead', () => {
    const t = new CueTracker();
    const low = base({ self: { dead: false, vitals: { health: 20 } } });
    expect(t.snap(low, 'Ana', 0)).toEqual([{ id: 'latido' }]);
    expect(t.snap(low, 'Ana', 0.5)).toEqual([]);
    expect(t.snap(low, 'Ana', 1.2)).toEqual([{ id: 'latido' }]);
    expect(t.snap(base({ self: { dead: true, vitals: { health: 0 } } }), 'Ana', 5)).toEqual([]);
  });
  it('actions and toasts', () => {
    expect(actionCue('roll')).toBe('rodar');
    expect(actionCue('menu')).toBe('menu');
    expect(actionCue('act')).toBeNull();
    expect(toastCue('Aún no tienes montura')).toBe('no');
    expect(toastCue('Nada a tiro')).toBe('no');
    expect(toastCue('Viajando… 3 s')).toBe('toast');
    expect(actionCue('wall')).toBeNull(); // building sounds when the place is sent
  });
  it('what I send', () => {
    expect(sendCue({ t: 'attack', id: 1 })).toBe('golpe-aire');
    expect(sendCue({ t: 'harvest', id: 1 }, 'rock')).toBe('picar');
    expect(sendCue({ t: 'harvest', id: 1 }, 'bush')).toBe('bayas');
    expect(sendCue({ t: 'power', x: 0, z: 0 })).toBe('enredadera');
    expect(sendCue({ t: 'power', x: 0, z: 0, kind: 'piedra' })).toBe('piedra');
    expect(sendCue({ t: 'place', kind: 'wall', x: 0, z: 0, rot: 0 })).toBe('construir');
    expect(sendCue({ t: 'travel', to: 'heart' })).toBe('viaje');
  });
});
