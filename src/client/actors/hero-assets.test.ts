import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATLAS_GRID, HERO_PALETTE } from './hero-palette';

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
