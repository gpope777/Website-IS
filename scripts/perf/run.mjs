#!/usr/bin/env node
// V2-A performance harness (spec 2026-09-27-visuales-design.md §8). Not part of `npm test`.
//
//   npm run perf                 measure and compare with scripts/perf/baseline.json
//   npm run perf -- --update     measure and rewrite the baseline
//   npm run perf -- --tier low   one tier only (no baseline rewrite of the others)
//   npm run perf -- --stop bosque  one stop only (comma list allowed)
//   npm run perf -- --top        also print the biggest meshes (triangle hogs) per reading
//   npm run perf -- --shots      also save a PNG per reading in scratch/perf/shots/
//   npm run perf -- --vitrina [list]  V2-E: shoot the client-only showcase (mounts, enemies, paper, pose:<anim>) day and night
//   npm run perf -- --ola        also shoot a forest zone healing (client-only cleanse) at 0/5/10/20 s
//
// Builds the client with `--mode perf` (it has the `?perf=1` hook) into scratch/perf/dist, starts
// `wrangler dev` on a throw-away state dir, creates world "perf" with seed 42, and walks a fixed
// camera route in Chromium headless (SwiftShader). It reads renderer.info (draw calls, triangles…),
// never FPS: SwiftShader is not a phone. Chromium: $PERF_CHROMIUM, else $PLAYWRIGHT_BROWSERS_PATH,
// else /opt/pw-browsers; with none it says so and exits 0 (skipped).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'scratch', 'perf');
const BASELINE = join(ROOT, 'scripts', 'perf', 'baseline.json');
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'perf-local';
const SEED = 42;
const FRAMES = 30;
const DAY = 360; // DAY_LENGTH (s)
/** Re-import a safe world when this many seconds passed since the last one (a day is 6 min; night from 0.8). */
const SAFE_EVERY = 100;

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const SHOTS = args.includes('--shots');
const onlyStop = args.includes('--stop') ? args[args.indexOf('--stop') + 1] : null;
const TOP = args.includes('--top');
const OLA = args.includes('--ola');
const VITRINA = args.includes('--vitrina') ? (args[args.indexOf('--vitrina') + 1] ?? '').startsWith('--') || !args[args.indexOf('--vitrina') + 1] ? 'mounts,enemies,paper,pose:roll,pose:block,pose:bow,pose:climb,pose:glide,pose:slide' : args[args.indexOf('--vitrina') + 1] : null;
const onlyTier = args.includes('--tier') ? args[args.indexOf('--tier') + 1] : null;

/** Spec §3 budgets (worst biome, by day). */
const BUDGET = { low: { calls: 120, triangles: 250_000 }, medium: { calls: 180, triangles: 500_000 }, high: { calls: 260, triangles: 1_200_000 } };
const TIERS = onlyTier ? [onlyTier] : ['low', 'medium', 'high'];
const WATER = -3.2;
/** The fixed route: yaw 0 looks toward −Z (north). */
const STOPS = [
  { name: 'bosque', x: 0, z: 60, yaw: 0, pitch: -0.15 },
  { name: 'costa', x: 0, z: 275, yaw: Math.PI, pitch: -0.15 },
  { name: 'bajo-agua', x: 0, z: 330, y: WATER - 6, yaw: Math.PI, pitch: -0.1 },
  { name: 'pantano', x: -340, z: 160, yaw: 0, pitch: -0.15 },
  { name: 'montanas', x: 20, z: -300, yaw: 0, pitch: -0.05 },
  { name: 'tierras', x: 0, z: -560, yaw: 0, pitch: -0.1 },
  { name: 'purificado', x: 0, z: -560, yaw: 0, pitch: -0.1, purified: true },
  // V2-D: el Lago Negro (seed 42) from its south shore, dark and then purified clean.
  { name: 'lago', x: -121, z: -533, yaw: 0, pitch: -0.3 },
  { name: 'lago-limpio', x: -121, z: -533, yaw: 0, pitch: -0.3, purified: true },
  { name: 'mazmorra', x: 390, z: 85, yaw: 0, pitch: -0.15 },
];
const HOURS = [
  { name: 'dia', frac: 0.5 },
  { name: 'noche', frac: 0 },
];
const FIELDS = ['calls', 'triangles', 'points', 'geometries', 'textures', 'programs'];

function findChromium() {
  if (process.env.PERF_CHROMIUM) return existsSync(process.env.PERF_CHROMIUM) ? { exe: process.env.PERF_CHROMIUM } : null;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(dir)) return null;
  process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
  return { exe: undefined };
}

const children = [];
function cleanup() {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

async function waitHttp(url, secs) {
  for (let i = 0; i < secs * 4; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nada en ${url} tras ${secs} s`);
}

const auth = { Authorization: `Bearer ${TOKEN}` };
let safeAt = 0;
/**
 * The client holds the test player at the stops but the server keeps it where it logged in, and the
 * 6-min day turns to night mid-run: wolves could kill it (graves, drawings → other texture counts).
 * Export the world, set it to morning with everyone alive and fed, import it back. Admin-only; the
 * page reconnects by itself.
 */
async function safeWorld(page) {
  const r = await fetch(`${BASE}/admin/perf/export`, { headers: auth });
  if (!r.ok) throw new Error(`exportar mundo: ${r.status}`);
  const w = await r.json();
  w.time = Math.floor(w.time / DAY) * DAY + 0.3 * DAY;
  for (const p of w.players) Object.assign(p, { dead: false, vitals: { health: 100, hunger: 100, warmth: 100 } });
  const i = await fetch(`${BASE}/admin/perf/import`, { method: 'POST', headers: auth, body: JSON.stringify(w) });
  if (!i.ok) throw new Error(`importar mundo: ${i.status}`);
  safeAt = Date.now();
  if (page) {
    await page.waitForFunction(() => !window.__perf?.online(), null, { timeout: 10_000, polling: 100 }).catch(() => {});
    await page.waitForFunction(() => window.__perf?.online(), null, { timeout: 60_000, polling: 250 });
  }
}

async function main() {
  const found = findChromium();
  let chromium;
  try {
    if (!found) throw new Error('no browser dir');
    ({ chromium } = await import('playwright-core'));
  } catch (e) {
    console.log(`Sin Chromium: define PERF_CHROMIUM o PLAYWRIGHT_BROWSERS_PATH (o instala /opt/pw-browsers). Arnés saltado. (${e.message})`);
    return 0;
  }

  mkdirSync(OUT, { recursive: true });
  console.log('Construyendo el cliente (--mode perf)…');
  execFileSync('npx', ['vite', 'build', '--mode', 'perf', '--outDir', join(OUT, 'dist'), '--emptyOutDir', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit' });
  const state = join(OUT, 'state');
  rmSync(state, { recursive: true, force: true });
  console.log('Arrancando wrangler dev…');
  const w = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--assets', join(OUT, 'dist'), '--persist-to', state, '--var', `ADMIN_TOKEN:${TOKEN}`, '--show-interactive-dev-session=false'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(w);
  let wlog = '';
  w.stdout.on('data', (d) => (wlog += d));
  w.stderr.on('data', (d) => (wlog += d));
  try {
    await waitHttp(`${BASE}/`, 90);
  } catch (e) {
    console.error(wlog.slice(-2000));
    throw e;
  }
  const made = await fetch(`${BASE}/admin/perf/create`, { method: 'POST', headers: auth, body: JSON.stringify({ seed: SEED }) });
  if (!made.ok) throw new Error(`crear mundo: ${made.status}`);

  let browser;
  try {
    browser = await chromium.launch({ executablePath: found.exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  } catch (e) {
    console.log(`Sin Chromium utilizable: ${e.message.split('\n')[0]}. Arnés saltado.`);
    return 0;
  }
  const readings = {};
  if (SHOTS) mkdirSync(join(OUT, 'shots'), { recursive: true });
  for (const tier of TIERS) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(
      ([t]) => {
        localStorage.setItem('bosque.tier', t);
        localStorage.setItem('bosque.join', JSON.stringify({ world: 'perf', name: 'Perf', pin: '1234' }));
      },
      [tier],
    );
    await safeWorld(null);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
    await page.goto(`${BASE}/?perf=1&mundo=perf`);
    await page.click('button[type=submit]');
    await page.waitForFunction(() => window.__perf?.ready(), null, { timeout: 180_000, polling: 500 });
    const got = await page.evaluate(() => window.__perf.tier());
    if (got !== tier) throw new Error(`gama ${got}, esperaba ${tier}`);
    for (const s of STOPS.filter((q) => !onlyStop || onlyStop.split(',').includes(q.name)))
      for (const h of HOURS) {
        const key = `${tier}/${s.name}/${h.name}`;
        if (Date.now() - safeAt > SAFE_EVERY * 1000) await safeWorld(page);
        await page.evaluate((p) => window.__perf.stop(p), { x: s.x, z: s.z, y: s.y, yaw: s.yaw, pitch: s.pitch, frac: h.frac, purified: s.purified });
        await page.evaluate(
          (n) =>
            new Promise((done) => {
              let k = 0;
              const tick = () => (++k >= n ? done() : requestAnimationFrame(tick));
              requestAnimationFrame(tick);
            }),
          FRAMES,
        );
        readings[key] = await page.evaluate(() => window.__perf.info());
        if (TOP) console.log((await page.evaluate(() => window.__perf.top(12))).map((h) => `      ${String(h.tris).padStart(8)} ${h.culled ? ' ' : '*'} ${h.name}`).join('\n'));
        if (SHOTS) await page.screenshot({ path: join(OUT, 'shots', `${key.replaceAll('/', '_')}.png`) });
        process.stdout.write(`  ${key.padEnd(26)} ${readings[key].calls} llamadas, ${readings[key].triangles} triángulos\n`);
      }
    if (OLA) {
      mkdirSync(join(OUT, 'shots'), { recursive: true });
      const zn = (await page.evaluate(() => window.__perf.zones())).find((z) => z.id === 1);
      if (zn) {
        await page.evaluate((p) => window.__perf.stop(p), { x: zn.x, z: zn.z + 8, yaw: 0, pitch: -0.45, frac: 0.5 });
        await page.waitForTimeout(3000);
        await page.evaluate(() => window.__perf.cleanse(1));
        const t0 = Date.now();
        for (const s of [0, 5, 10, 20]) {
          await page.waitForTimeout(Math.max(0, t0 + s * 1000 - Date.now()));
          await page.screenshot({ path: join(OUT, 'shots', `${tier}_ola_${s}s.png`) });
        }
      }
    }
    if (VITRINA) {
      mkdirSync(join(OUT, 'shots'), { recursive: true });
      for (const h of HOURS) {
        await page.evaluate((p) => window.__perf.stop(p), { x: 0, z: 60, yaw: 0, pitch: -0.2, frac: h.frac });
        for (const what of VITRINA.split(',')) {
          await page.evaluate((w) => window.__perf.showcase(w), what);
          await page.waitForTimeout(what === 'pose:roll' ? 150 : 2500);
          await page.screenshot({ path: join(OUT, 'shots', `${tier}_vitrina_${what.replace(':', '-')}_${h.name}.png`) });
        }
        await page.evaluate(() => window.__perf.showcase(null));
      }
      await page.evaluate((p) => window.__perf.stop(p), { x: 0, z: 275, yaw: Math.PI, pitch: -0.15, frac: 0 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(OUT, 'shots', `${tier}_vitrina_costa_noche.png`) });
    }
    if (errors.length) console.log(`  errores de página (${tier}): ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();

  writeFileSync(join(OUT, 'perf-report.json'), JSON.stringify({ seed: SEED, frames: FRAMES, readings }, null, 2) + '\n');
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { readings: {} };
  const fails = [];
  const rows = [];
  for (const [key, r] of Object.entries(readings)) {
    const b = base.readings[key];
    const tier = key.split('/')[0];
    const notes = [];
    for (const f of FIELDS) if (b && r[f] > b[f] * 1.1 && r[f] > b[f]) notes.push(`${f} ${b[f]}→${r[f]}`);
    const over = r.calls > BUDGET[tier].calls || r.triangles > BUDGET[tier].triangles;
    if (over && (!b || r.calls > b.calls || r.triangles > b.triangles)) notes.push('pasa el presupuesto');
    if (notes.length) fails.push(`${key}: ${notes.join(', ')}`);
    rows.push({ lectura: key, llamadas: r.calls, triangulos: r.triangles, puntos: r.points, geometrias: r.geometries, texturas: r.textures, programas: r.programs, presupuesto: over ? 'PASA' : 'ok', base: b ? (notes.length ? 'SUBE' : 'igual') : '—' });
  }
  console.table(rows);
  if (UPDATE) {
    const merged = { seed: SEED, frames: FRAMES, budget: BUDGET, readings: { ...base.readings, ...readings } };
    writeFileSync(BASELINE, JSON.stringify(merged, null, 2) + '\n');
    console.log(`Base actualizada: ${BASELINE}`);
    return 0;
  }
  if (fails.length) {
    console.log(`\nFALLA (${fails.length}):\n  ${fails.join('\n  ')}\nSi es a propósito: npm run perf -- --update`);
    return 1;
  }
  console.log('\nTodo dentro de la base y del presupuesto.');
  return 0;
}

main()
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch((e) => {
    console.error(e);
    cleanup();
    process.exit(2);
  });
