import { describe, expect, it } from 'vitest';
import { decodeClient, PROTOCOL_VERSION } from './protocol';

const ok = (m: unknown) => expect(decodeClient(JSON.stringify(m))).toEqual(m);
const bad = (raw: string) => expect(decodeClient(raw)).toBeNull();

describe('decodeClient', () => {
  it('accepts every valid message', () => {
    ok({ t: 'hello', v: 1, name: 'Mateo', pin: '0420' });
    ok({ t: 'hello', v: 1, name: 'José Ñ-2', pin: '1234' });
    ok({ t: 'move', x: 1.5, y: 2, z: -3, yaw: 0.5, anim: 'run' });
    ok({ t: 'harvest', id: 12 });
    ok({ t: 'place', kind: 'wall', x: 1, z: 2, rot: 0 });
    ok({ t: 'attack', id: 3 });
    ok({ t: 'eat' });
    ok({ t: 'respawn' });
    ok({ t: 'dungeon', act: 0 });
    ok({ t: 'dungeon', act: 4 });
    ok({ t: 'dungeon', act: 7 });
  });

  it('rejects bad dungeon acts', () => {
    bad(JSON.stringify({ t: 'dungeon', act: 26 })); // 8–12 the coast Raíz-madre (S2-F), 13–17 the swamp's (S3-E), 18–25 the mountain cave's (S4-E)
    bad(JSON.stringify({ t: 'dungeon', act: -1 }));
    bad(JSON.stringify({ t: 'dungeon', act: 1.5 }));
    bad(JSON.stringify({ t: 'dungeon' }));
  });

  it('rejects garbage', () => {
    bad('not json');
    bad('[]');
    bad('null');
    bad(JSON.stringify({ t: 'fly' }));
  });

  it('rejects bad hello', () => {
    bad(JSON.stringify({ t: 'hello', v: 1, name: '', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'x'.repeat(17), pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: '<b>hi</b>', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: ' Ana', pin: '1234' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'Ana', pin: '12a4' }));
    bad(JSON.stringify({ t: 'hello', v: 1, name: 'Ana', pin: '12345' }));
  });

  it('rejects bad numbers and enums', () => {
    bad('{"t":"move","x":1e999,"y":0,"z":0,"yaw":0,"anim":"idle"}');
    bad(JSON.stringify({ t: 'move', x: '1', y: 0, z: 0, yaw: 0, anim: 'idle' }));
    bad(JSON.stringify({ t: 'move', x: 1, y: 0, z: 0, yaw: 0, anim: 'moonwalk' }));
    bad(JSON.stringify({ t: 'harvest', id: -1 }));
    bad(JSON.stringify({ t: 'harvest', id: 1.5 }));
    bad(JSON.stringify({ t: 'place', kind: 'castle', x: 1, z: 2, rot: 0 }));
  });
});

describe('aventura protocol', () => {
  it("is the current version", () => {
    expect(PROTOCOL_VERSION).toBe(40);
  });
  it('decodes tend and rejects a bad id', () => {
    expect(decodeClient('{"t":"tend","id":3}')).toEqual({ t: 'tend', id: 3 });
    expect(decodeClient('{"t":"tend","id":-1}')).toBeNull();
    expect(decodeClient('{"t":"tend"}')).toBeNull();
  });
  it('accepts placing the new kinds', () => {
    expect(decodeClient('{"t":"place","kind":"heart","x":1,"z":2,"rot":0}')).toMatchObject({ kind: 'heart' });
    expect(decodeClient('{"t":"place","kind":"spikes","x":1,"z":2,"rot":0}')).toMatchObject({ kind: 'spikes' });
    expect(decodeClient('{"t":"place","kind":"roots","x":1,"z":2,"rot":0}')).toMatchObject({ kind: 'roots' });
  });
});

describe('combat protocol', () => {
  it('decodes roll, block and shoot', () => {
    expect(decodeClient('{"t":"roll"}')).toEqual({ t: 'roll' });
    expect(decodeClient('{"t":"block","on":true}')).toEqual({ t: 'block', on: true });
    expect(decodeClient('{"t":"block","on":"yes"}')).toBeNull();
    expect(decodeClient('{"t":"shoot","id":4}')).toEqual({ t: 'shoot', id: 4 });
    expect(decodeClient('{"t":"shoot","id":1.5}')).toBeNull();
  });
  it('accepts the new anims', () => {
    for (const anim of ['roll', 'block', 'bow']) {
      expect(decodeClient(JSON.stringify({ t: 'move', x: 0, y: 0, z: 0, yaw: 0, anim }))).not.toBeNull();
    }
  });
});

describe('revive protocol', () => {
  it('decodes revive with a valid name only', () => {
    expect(decodeClient('{"t":"revive","name":"Ana"}')).toEqual({ t: 'revive', name: 'Ana' });
    expect(decodeClient('{"t":"revive","name":""}')).toBeNull();
    expect(decodeClient('{"t":"revive","name":5}')).toBeNull();
  });
});

describe('traversal protocol', () => {
  it('accepts climb and glide anims', () => {
    for (const anim of ['climb', 'glide']) {
      expect(decodeClient(JSON.stringify({ t: 'move', x: 0, y: 0, z: 0, yaw: 0, anim }))).not.toBeNull();
    }
  });
});

describe('power and shrine protocol', () => {
  it('decodes power and shrine messages', () => {
    ok({ t: 'power', x: 1, z: 2 });
    ok({ t: 'shrine', id: 0, part: 2 });
    ok({ t: 'shrine', id: 5, part: 3 });
    ok({ t: 'shrine', id: 6, part: 4 });
    ok({ t: 'shrine', id: 11, part: 7 }); // S4-C: Bloques' reset lever
    ok({ t: 'quartz', id: 9 });
    bad('{"t":"quartz","id":10}');
    bad('{"t":"quartz","id":1.5}');
    bad('{"t":"shrine","id":0,"part":8}'); // S4-C: parts go up to 7 (intentional)
    bad('{"t":"shrine","id":0,"part":-1}');
    bad('{"t":"shrine","id":0,"part":1.5}');
    bad('{"t":"power","x":"1","z":2}');
    bad('{"t":"power","x":1}');
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('mount protocol', () => {
  it('decodes mount acts and needs a time to tap', () => {
    ok({ t: 'mount', act: 0 });
    ok({ t: 'mount', act: 1, at: 12.5 });
    ok({ t: 'mount', act: 3 });
    expect(decodeClient('{"t":"mount","act":2,"at":5}')).toEqual({ t: 'mount', act: 2 });
    bad('{"t":"mount","act":1}');
    bad('{"t":"mount","act":1,"at":"5"}');
    ok({ t: 'mount', act: 4 });
    ok({ t: 'mount', act: 5 });
    ok({ t: 'mount', act: 6 });
    ok({ t: 'mount', act: 8 });
    ok({ t: 'mount', act: 9 });
    ok({ t: 'mount', act: 11 });
    ok({ t: 'mount', act: 12 });
    ok({ t: 'mount', act: 14 });
    bad('{"t":"mount","act":15}');
    bad('{"t":"mount","act":-1}');
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('chest and upgrade protocol', () => {
  it('decodes chests and upgrades', () => {
    ok({ t: 'chest', id: 3 });
    ok({ t: 'upgrade' });
    bad('{"t":"chest","id":-1}');
    bad('{"t":"chest","id":1.5}');
    bad('{"t":"chest"}');
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('S2-F protocol', () => {
  it('decodes the coast dungeon acts and the power kind', () => {
    expect(decodeClient(JSON.stringify({ t: 'dungeon', act: 12 }))).toEqual({ t: 'dungeon', act: 12 });
    expect(decodeClient(JSON.stringify({ t: 'power', x: 1, z: 2, kind: 'viento' }))).toEqual({ t: 'power', x: 1, z: 2, kind: 'viento' });
    expect(decodeClient(JSON.stringify({ t: 'power', x: 1, z: 2, kind: 'enredadera' }))).toEqual({ t: 'power', x: 1, z: 2, kind: 'enredadera' });
    expect(decodeClient(JSON.stringify({ t: 'power', x: 1, z: 2, kind: 'rayo' }))).toBeNull();
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('rescue protocol (S2-H)', () => {
  it('decodes the cage release', () => {
    ok({ t: 'rescue' });
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('amber and capa protocol (S3-C)', () => {
  it('decodes amber and capa', () => {
    ok({ t: 'amber', id: 3 });
    ok({ t: 'capa' });
    bad('{"t":"amber","id":-1}');
    bad('{"t":"amber","id":"1"}');
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('swamp dungeon and Fuego protocol (S3-E)', () => {
  it('decodes the swamp dungeon acts, Fuego and the hoguera', () => {
    ok({ t: 'dungeon', act: 17 });
    bad(JSON.stringify({ t: 'dungeon', act: 26 })); // S4-E: acts 18–25 are the mountain cave's
    ok({ t: 'power', x: 1, z: 2, kind: 'fuego' });
    ok({ t: 'place', kind: 'fire', x: 1, z: 2, rot: 0 });
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('fogatas protocol (S3-G)', () => {
  it('decodes lighting and travel', () => {
    ok({ t: 'fogata', id: 2 });
    ok({ t: 'travel', to: 'heart' });
    ok({ t: 'travel', to: 3 });
    ok({ t: 'travel', to: 5 }); // S4-C: the mountain refugios
    bad(JSON.stringify({ t: 'travel', to: 6 }));
    bad(JSON.stringify({ t: 'travel', to: -1 }));
    bad(JSON.stringify({ t: 'travel', to: 'casa' }));
    bad(JSON.stringify({ t: 'fogata', id: 6 }));
    expect(PROTOCOL_VERSION).toBe(40);
  });
});

describe('mountain dungeon and Piedra protocol (S4-E)', () => {
  it('decodes the cave acts, Piedra and the torre; a pillar is never placed', () => {
    ok({ t: 'dungeon', act: 25 });
    bad(JSON.stringify({ t: 'dungeon', act: 26 }));
    ok({ t: 'power', x: 1, z: 2, kind: 'piedra' });
    ok({ t: 'place', kind: 'tower', x: 1, z: 2, rot: 0 });
    bad(JSON.stringify({ t: 'place', kind: 'pillar', x: 1, z: 2, rot: 0 }));
    expect(PROTOCOL_VERSION).toBe(40);
  });
});
