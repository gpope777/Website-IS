import { describe, expect, it } from 'vitest';
import { decodeClient } from './protocol';

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
