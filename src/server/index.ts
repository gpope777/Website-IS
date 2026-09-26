import { WORLD_RE } from '../shared/protocol';

export { WorldRoom } from './world-room';

const WS = /^\/ws\/([^/]+)$/;
const ADMIN = /^\/admin\/([^/]+)\/(create|export|import)$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const ws = url.pathname.match(WS);
    if (ws && WORLD_RE.test(ws[1]!)) return room(env, ws[1]!).fetch(request);
    const admin = url.pathname.match(ADMIN);
    if (admin && WORLD_RE.test(admin[1]!)) {
      if (!authorized(request, env)) return new Response('Unauthorized', { status: 401 });
      return room(env, admin[1]!).fetch(new Request(new URL(`/admin/${admin[2]}`, url), request));
    }
    if (url.pathname.startsWith('/admin/')) return new Response('Unauthorized', { status: 401 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function room(env: Env, world: string) {
  return env.WORLDS.get(env.WORLDS.idFromName(world));
}

function authorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const got = new TextEncoder().encode(request.headers.get('Authorization') ?? '');
  const want = new TextEncoder().encode(`Bearer ${env.ADMIN_TOKEN}`);
  return got.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(got, want);
}
