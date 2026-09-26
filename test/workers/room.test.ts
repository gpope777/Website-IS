import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ADMIN, BASE, Client, createWorld, sleep } from './helpers';

describe('admin', () => {
  it('requires the token', async () => {
    const res = await exports.default.fetch(`${BASE}/admin/nope/export`);
    expect(res.status).toBe(401);
  });

  it('creates once, exports and imports', async () => {
    expect((await createWorld('adm-1', 7)).status).toBe(200);
    expect((await createWorld('adm-1', 7)).status).toBe(409);
    const saved = await (await exports.default.fetch(`${BASE}/admin/adm-1/export`, { headers: ADMIN })).json<{ seed: number }>();
    expect(saved.seed).toBe(7);
    const imp = await exports.default.fetch(`${BASE}/admin/adm-1/import`, { method: 'POST', headers: ADMIN, body: JSON.stringify(saved) });
    expect(imp.status).toBe(200);
    const bad = await exports.default.fetch(`${BASE}/admin/adm-1/import`, { method: 'POST', headers: ADMIN, body: '{"x":1}' });
    expect(bad.status).toBe(400);
  });
});

describe('joining', () => {
  it('rejects unknown worlds and old clients', async () => {
    const a = await Client.open('no-such-world');
    a.send({ t: 'hello', v: 1, name: 'Ana', pin: '1234' });
    expect((await a.next('error')).code).toBe('noworld');
    await createWorld('join-v');
    const b = await Client.open('join-v');
    b.send({ t: 'hello', v: 999, name: 'Ana', pin: '1234' });
    expect((await b.next('error')).code).toBe('version');
  });

  it('claims a name with the first PIN and checks it after', async () => {
    await createWorld('join-pin');
    const a = await Client.open('join-pin');
    expect((await a.join('Ana', '1111')).you).toBe('Ana');
    a.close();
    const b = await Client.open('join-pin');
    b.send({ t: 'hello', v: 1, name: 'Ana', pin: '2222' });
    expect((await b.next('error')).code).toBe('pin');
    const c = await Client.open('join-pin');
    expect((await c.join('Ana', '1111')).you).toBe('Ana');
  });

  it('rate-limits PIN guessing', async () => {
    await createWorld('join-rate');
    const a = await Client.open('join-rate');
    await a.join('Ana', '1111');
    const codes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c = await Client.open('join-rate');
      c.send({ t: 'hello', v: 1, name: 'Ana', pin: '9999' });
      codes.push((await c.next('error')).code);
    }
    expect(codes.slice(0, 5)).toEqual(['pin', 'pin', 'pin', 'pin', 'pin']);
    expect(codes[5]).toBe('rate');
  });
});

describe('playing', () => {
  it('two players see each other and inventory is saved', async () => {
    await createWorld('play-1');
    const a = await Client.open('play-1');
    const b = await Client.open('play-1');
    await a.join('Ana');
    await b.join('Leo');
    await sleep(250);
    a.msgs.length = 0; // drop snaps from before Leo joined
    const snap = await a.next('snap');
    expect(snap.players.map((p) => p.name)).toContain('Leo');
    a.close();
    b.close();
    await sleep(100);
    const saved = await (await exports.default.fetch(`${BASE}/admin/play-1/export`, { headers: ADMIN })).json<{ players: { name: string }[] }>();
    expect(saved.players.map((p) => p.name).sort()).toEqual(['Ana', 'Leo']);
  });

  it('drops a socket that keeps sending garbage', async () => {
    await createWorld('play-bad');
    const a = await Client.open('play-bad');
    let closed = false;
    a.ws.addEventListener('close', () => (closed = true));
    for (let i = 0; i < 25; i++) a.ws.send('garbage');
    await sleep(200);
    expect(closed).toBe(true);
  });
});
