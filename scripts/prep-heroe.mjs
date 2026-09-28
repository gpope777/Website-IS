#!/usr/bin/env node
// Trims the KayKit Character Pack: Adventurers 1.0 (Kay Lousberg, CC0,
// https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) into the
// game's heroe-*.glb files, and generates src/client/actors/hero-palette.ts from the
// atlas textures. This script is committed but its dependencies are NOT added to the
// project's package.json — install them in a scratch folder and pass that folder in:
//
//   npm i --no-save @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions pngjs
//   node <repo>/scripts/prep-heroe.mjs <dir-with-KayKit-glbs>
//
// <dir-with-KayKit-glbs> must contain Knight.glb, Barbarian.glb, Mage.glb, Rogue.glb
// (downloaded from the URL above) and is also where `npm i` was run — the script resolves
// its dependencies from THAT folder (via createRequire), not from scripts/, so it still
// works when scripts/ itself has no node_modules for them. Output paths are resolved
// relative to this file's own location (repo/public/models, repo/src/client/actors).
//
// @gltf-transform/extensions is needed only to register KHR_mesh_quantization so
// `quantize()` (see below) round-trips correctly; it installs alongside functions/core.

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node prep-heroe.mjs <dir-with-KayKit-glbs>');
  process.exit(1);
}
const resolvedSourceDir = path.resolve(sourceDir);
const req = createRequire(pathToFileURL(path.join(resolvedSourceDir, 'package.json')).href);
const importFromSource = (spec) => import(pathToFileURL(req.resolve(spec)).href);

const { NodeIO } = await importFromSource('@gltf-transform/core');
const { prune, dedup, quantize, resample } = await importFromSource('@gltf-transform/functions');
const { KHRMeshQuantization } = await importFromSource('@gltf-transform/extensions');
const { PNG } = await importFromSource('pngjs');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, '..');
const modelsDir = path.join(repoRoot, 'public', 'models');
const paletteFile = path.join(repoRoot, 'src', 'client', 'actors', 'hero-palette.ts');

const MAP = { Knight: 'caballero', Barbarian: 'barbaro', Mage: 'maga', Rogue: 'picaro' };

// Every clip the game plays (src/client/actors/hero-assets.test.ts keeps its own copy of
// this list — keep them in sync).
const CLIPS = [
  'Idle', 'Walking_A', 'Walking_B', 'Running_A', 'Jump_Full_Short', 'Jump_Idle', 'Jump_Land',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Spin',
  'Dodge_Forward', 'Blocking', 'Block_Hit', 'Block_Attack', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Hit_A',
  'Sit_Chair_Idle', 'Cheer', 'Death_A',
];
const CLIP_SET = new Set(CLIPS);

// Disposing an Animation does NOT cascade to its AnimationChannel/AnimationSampler
// children in @gltf-transform 4.x (verified empirically: prune() left ~8800 dead
// accessors behind per file, ~2MB of dead weight). Dispose channels and samplers first.
function disposeAnimation(anim) {
  anim.listChannels().forEach((c) => c.dispose());
  anim.listSamplers().forEach((s) => s.dispose());
  anim.dispose();
}

function sizeOf(file) {
  return fs.statSync(file).size;
}

// ---------------------------------------------------------------------------------------
// Bodies: mesh + skeleton + texture, no animations.
// ---------------------------------------------------------------------------------------
async function buildBody(srcName, body) {
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const doc = await io.read(path.join(resolvedSourceDir, `${srcName}.glb`));
  const root = doc.getRoot();
  root.listAnimations().forEach(disposeAnimation);
  await doc.transform(
    prune(),
    dedup(),
    // quantize() is not in the brief's minimal recipe, but prune()+dedup() alone leave
    // each body at ~350 KB (mesh/skin float data for body + every prop mesh, which must
    // stay for later tasks to toggle by name) — 4 bodies + anims blows the 1.5 MB budget.
    // 'scene' (one shared quantization volume, not 'mesh') keeps a single Skin instead of
    // one per skinned mesh, matching the "skins has length 1" requirement.
    quantize({ quantizationVolume: 'scene' }),
  );
  const out = path.join(modelsDir, `heroe-${body}.glb`);
  await io.write(out, doc);
  return out;
}

// ---------------------------------------------------------------------------------------
// Anims: skeleton + only the clips in CLIPS, no meshes.
// ---------------------------------------------------------------------------------------
async function buildAnims() {
  const io = new NodeIO();
  const doc = await io.read(path.join(resolvedSourceDir, 'Knight.glb'));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (!CLIP_SET.has(a.getName())) disposeAnimation(a);
  }
  root.listMeshes().forEach((m) => m.dispose());
  await doc.transform(
    // Loses no clip data by name; drops keyframes a slerp/lerp within tolerance would
    // reproduce anyway. Needed to fit the budget (21 clips x ~50 bones is heavy at full
    // per-frame keyframing); 0.005 is a loose-but-safe tolerance for a low-poly character.
    resample({ tolerance: 0.005 }),
    prune({ keepLeaves: true }), // keepLeaves: the now-meshless skeleton nodes must stay
    dedup(),
  );
  const out = path.join(modelsDir, 'heroe-anims.glb');
  await io.write(out, doc);
  return out;
}

// ---------------------------------------------------------------------------------------
// Palette: detect the atlas grid, then classify cloth/skin cells from mesh UVs.
// ---------------------------------------------------------------------------------------
function pixelAt(png, x, y) {
  const cx = Math.min(png.width - 1, Math.max(0, x));
  const cy = Math.min(png.height - 1, Math.max(0, y));
  const i = (png.width * cy + cx) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}
function closeEnough(a, b, tol) {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

// The atlas is a grid of colour cells, each a vertical gradient (bright top, shaded
// bottom) that is flat left-to-right. Columns: pick the largest candidate where every
// cell's row of pixels is flat within +-6/channel over its inner 76% (the outer edge
// blends into the next cell). Rows: the flat-check can't detect rows (subdividing a real
// row's gradient further is still "flat" by that test), so rows are instead the largest
// candidate where every internal boundary is a real colour jump (>20/channel) rather than
// a point along the smooth gradient.
function detectGrid(png, candidates = [16, 8, 4]) {
  let cols = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (png.width % c !== 0) continue;
    const cw = png.width / c;
    let ok = true;
    outer: for (let cx = 0; cx < c; cx++) {
      for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 8))) {
        const base = pixelAt(png, cx * cw, y);
        for (let rx = 0; rx < cw * 0.76; rx += Math.max(1, Math.floor(cw / 4))) {
          if (!closeEnough(base, pixelAt(png, cx * cw + rx, y), 6)) { ok = false; break outer; }
        }
      }
    }
    if (ok) { cols = c; break; }
  }
  const colX = Math.floor(png.width / cols / 2);
  let rows = candidates[candidates.length - 1];
  for (const r of candidates) {
    if (png.height % r !== 0) continue;
    const ch = png.height / r;
    let ok = true;
    for (let i = 1; i < r; i++) {
      const y = i * ch;
      const before = pixelAt(png, colX, y - 4);
      const after = pixelAt(png, colX, y + 3);
      const jump = Math.max(...before.map((v, k) => Math.abs(v - after[k])));
      if (jump <= 20) { ok = false; break; }
    }
    if (ok) { rows = r; break; }
  }
  return { cols, rows };
}

function cellMeanColor(png, cols, rows, c, r) {
  const cw = png.width / cols;
  const ch = png.height / rows;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = r * ch; y < (r + 1) * ch; y += 4) {
    for (let x = c * cw; x < (c + 1) * cw; x += 4) {
      const [R, G, B] = pixelAt(png, x, y);
      sr += R; sg += G; sb += B; n++;
    }
  }
  return [sr / n, sg / n, sb / n];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function cellsForNodes(root, cols, rows, suffixes) {
  const set = new Set();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName();
    if (!suffixes.some((s) => name.endsWith(s))) continue;
    for (const prim of mesh.listPrimitives()) {
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!uv) continue;
      const arr = uv.getArray();
      for (let i = 0; i < arr.length; i += 2) {
        const c = Math.min(cols - 1, Math.max(0, Math.floor(arr[i] * cols)));
        const r = Math.min(rows - 1, Math.max(0, Math.floor(arr[i + 1] * rows)));
        set.add(`${c},${r}`);
      }
    }
  }
  return [...set].map((s) => s.split(',').map(Number));
}

function isSkin({ h, s, v }) {
  return h >= 15 && h <= 40 && s >= 0.2 && s <= 0.6 && v > 0.6;
}
function isCloth({ s }) {
  return s > 0.25;
}

async function buildPalette(srcName, body, gridOverride) {
  const io = new NodeIO();
  const doc = await io.read(path.join(resolvedSourceDir, `${srcName}.glb`));
  const root = doc.getRoot();
  const texture = root.listTextures()[0];
  const png = PNG.sync.read(Buffer.from(texture.getImage()));
  const grid = gridOverride ?? detectGrid(png);

  const skinCandidates = cellsForNodes(root, grid.cols, grid.rows, ['_Head', '_ArmLeft', '_ArmRight']);
  const clothCandidates = cellsForNodes(root, grid.cols, grid.rows, [
    '_Body', '_Cape', '_LegLeft', '_LegRight', '_ArmLeft', '_ArmRight',
  ]);

  const withHsv = (cells) => cells.map(([c, r]) => ({ c, r, hsv: rgbToHsv(...cellMeanColor(png, grid.cols, grid.rows, c, r)) }));
  const skinInfo = withHsv(skinCandidates).filter((cell) => isSkin(cell.hsv));
  const skinKeys = new Set(skinInfo.map((cell) => `${cell.c},${cell.r}`));
  const clothInfo = withHsv(clothCandidates).filter((cell) => isCloth(cell.hsv) && !skinKeys.has(`${cell.c},${cell.r}`));

  console.log(`  ${body}: grid ${grid.cols}x${grid.rows}`);
  for (const cell of skinInfo) {
    console.log(`    skin  (${cell.c},${cell.r}) hsv=[${cell.hsv.h.toFixed(0)},${cell.hsv.s.toFixed(2)},${cell.hsv.v.toFixed(2)}]`);
  }
  for (const cell of clothInfo) {
    console.log(`    cloth (${cell.c},${cell.r}) hsv=[${cell.hsv.h.toFixed(0)},${cell.hsv.s.toFixed(2)},${cell.hsv.v.toFixed(2)}]`);
  }

  return {
    grid,
    cloth: clothInfo.map((cell) => [cell.c, cell.r]),
    skin: skinInfo.map((cell) => [cell.c, cell.r]),
  };
}

// ---------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------
fs.mkdirSync(modelsDir, { recursive: true });

console.log('Palette:');
let atlasGrid = null;
const palette = {};
for (const [srcName, body] of Object.entries(MAP)) {
  const result = await buildPalette(srcName, body, atlasGrid);
  atlasGrid = atlasGrid ?? result.grid;
  palette[body] = { cloth: result.cloth, skin: result.skin };
}

const tsLines = [];
tsLines.push('// GENERATED by scripts/prep-heroe.mjs from the KayKit Adventurers atlases (CC0). Do not edit by hand.');
tsLines.push("export type Body = 'caballero' | 'barbaro' | 'maga' | 'picaro';");
tsLines.push(`export const ATLAS_GRID = { cols: ${atlasGrid.cols}, rows: ${atlasGrid.rows} } as const;`);
tsLines.push('/** Atlas cells [col, row] (row 0 = top of the image) that are clothing / skin, per body. */');
tsLines.push('export const HERO_PALETTE: Record<Body, { cloth: [number, number][]; skin: [number, number][] }> = {');
for (const body of Object.values(MAP)) {
  const p = palette[body];
  const fmt = (cells) => cells.map(([c, r]) => `[${c}, ${r}]`).join(', ');
  tsLines.push(`  ${body}: { cloth: [${fmt(p.cloth)}], skin: [${fmt(p.skin)}] },`);
}
tsLines.push('};');
tsLines.push('');
fs.writeFileSync(paletteFile, tsLines.join('\n'));
console.log(`Wrote ${path.relative(repoRoot, paletteFile)}`);

console.log('\nBodies:');
const outputs = [];
for (const [srcName, body] of Object.entries(MAP)) {
  const out = await buildBody(srcName, body);
  const size = sizeOf(out);
  outputs.push(size);
  console.log(`  heroe-${body}.glb: ${(size / 1024).toFixed(1)} KB`);
}

console.log('\nAnims:');
const animsOut = await buildAnims();
const animsSize = sizeOf(animsOut);
outputs.push(animsSize);
console.log(`  heroe-anims.glb: ${(animsSize / 1024).toFixed(1)} KB`);

const total = outputs.reduce((a, b) => a + b, 0);
console.log(`\nTotal: ${(total / 1024).toFixed(1)} KB (budget 1536.0 KB)`);
if (total > 1.5 * 1024 * 1024) {
  console.error('OVER BUDGET');
  process.exit(1);
}
