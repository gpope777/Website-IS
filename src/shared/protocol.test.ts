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
    bad(JSON.stringify({ t: 'dungeon', act: 8 })); // 5–7 are the block, lantern and brazier (cierre S1)
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
    expect(PROTOCOL_VERSION).toBe(14);
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
    bad('{"t":"shrine","id":0,"part":3}');
    bad('{"t":"shrine","id":0,"part":-1}');
    bad('{"t":"shrine","id":0,"part":1.5}');
    bad('{"t":"power","x":"1","z":2}');
    bad('{"t":"power","x":1}');
    expect(PROTOCOL_VERSION).toBe(14);
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
    bad('{"t":"mount","act":9}');
    bad('{"t":"mount","act":-1}');
    expect(PROTOCOL_VERSION).toBe(14);
  });
});
