import { describe, expect, it } from 'vitest';
import { ATLAS_GRID, HERO_PALETTE } from './hero-palette';

// This file's only Node dependency is `node:fs`, for two functions with a tiny surface
// (read a whole file, stat its size). Rather than widen the project's client-side tsconfig
// to expose Node's ambient globals to all browser code (or add @types/node just for this),
// give it the minimal shape used below and load it through a non-literal dynamic import —
// literal `import ... from 'node:fs'` (static or dynamic) makes tsc resolve and fail on the
// real (typeless) module; a specifier held in a variable isn't statically analysable, so tsc
// treats the result as `any` and the cast below applies cleanly. Keeps this test
// self-contained without adding a dependency or widening what the rest of src/client sees.
interface FileBytes {
  readUInt32LE(offset: number): number;
  readUInt32BE(offset: number): number;
  subarray(start: number, end?: number): FileBytes;
  toString(): string;
}
interface FsModule {
  readFileSync(path: string): FileBytes;
  statSync(path: string): { size: number };
}
const fsSpecifier = 'node:fs';
const { readFileSync, statSync }: FsModule = await import(fsSpecifier);

const BODIES = ['caballero', 'barbaro', 'maga', 'picaro'] as const;
const CLIPS = [
  'Idle', 'Walking_A', 'Walking_B', 'Running_A', 'Jump_Full_Short', 'Jump_Idle', 'Jump_Land',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Spin',
  'Dodge_Forward', 'Blocking', 'Block_Hit', 'Block_Attack', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Hit_A',
  'Sit_Chair_Idle', 'Cheer', 'Death_A',
];
function gltfJson(path: string) {
  const b = readFileSync(path);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
}
// Embedded-image width/height, read straight from the PNG IHDR chunk bytes sitting in the
// glb's BIN chunk (glTF: signature(8) + length(4BE) + 'IHDR'(4) + width(4BE) + height(4BE)).
function embeddedImageSize(path: string) {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8; // + BIN chunk header (4-byte length + 4-byte 'BIN\0')
  const bv = j.bufferViews[j.images[0].bufferView];
  const png = b.subarray(binStart + (bv.byteOffset ?? 0));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('hero assets (KayKit, prep-heroe.mjs)', () => {
  it('one anims file holds every clip the game plays, and nothing else', () => {
    const j = gltfJson('public/models/heroe-anims.glb');
    const names = j.animations.map((a: { name: string }) => a.name).sort();
    expect(names).toEqual([...CLIPS].sort());
  });
  it('each body has its mesh, the shared skeleton and no animations', () => {
    for (const b of BODIES) {
      const j = gltfJson(`public/models/heroe-${b}.glb`);
      expect(j.animations ?? []).toHaveLength(0);
      expect(j.skins).toHaveLength(1);
      const bones = j.skins[0].joints.map((i: number) => j.nodes[i].name);
      for (const n of ['hips', 'head', 'handslot.r', 'handslot.l']) expect(bones).toContain(n);
    }
  });
  it('fits the size budget (≤ 1.5 MB together)', () => {
    const total = ['anims', ...BODIES].reduce((s, n) => s + statSync(`public/models/heroe-${n}.glb`).size, 0);
    expect(total).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });
  it('each body texture is downsized to 128x128 (spec §1)', () => {
    for (const b of BODIES) {
      const { width, height } = embeddedImageSize(`public/models/heroe-${b}.glb`);
      expect(width).toBe(128);
      expect(height).toBe(128);
    }
  });
  it('the palette table names cloth and skin cells inside the grid for every body', () => {
    for (const b of BODIES) {
      const p = HERO_PALETTE[b];
      expect(p.cloth.length).toBeGreaterThan(0);
      expect(p.skin.length).toBeGreaterThan(0);
      for (const [c, r] of [...p.cloth, ...p.skin]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(ATLAS_GRID.cols);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(ATLAS_GRID.rows);
      }
      const skin = new Set(p.skin.map(String));
      expect(p.cloth.some((c) => skin.has(String(c)))).toBe(false);
    }
  });
});
