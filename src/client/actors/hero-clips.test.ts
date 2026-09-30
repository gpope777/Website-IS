import { describe, expect, it } from 'vitest';
import { ANIMS } from '../../shared/protocol';
import { BODIES, HERO_CLIPS, partVisible } from './hero-clips';

describe('hero clips', () => {
  it('every protocol anim and dead has a clip', () => {
    for (const a of [...ANIMS, 'dead', 'seat']) expect(HERO_CLIPS[a], a).toBeDefined();
  });
  it('the combo is three different swings; one-shots are once', () => {
    const c = ['attack1', 'attack2', 'attack3'].map((a) => HERO_CLIPS[a]!.clip);
    expect(new Set(c).size).toBe(3);
    for (const a of ['attack1', 'attack2', 'attack3', 'spin', 'roll', 'cast', 'hurt', 'cheer', 'jump', 'dead']) expect(HERO_CLIPS[a]!.once, a).toBe(true);
    expect(HERO_CLIPS.attack!.clip).toBe(HERO_CLIPS.attack1!.clip); // old clients' 'attack'
  });
});

describe('hero parts', () => {
  it('shows body parts, one 1-hand weapon and (knight/barbarian) one round shield', () => {
    expect(partVisible('caballero', 'Knight_Body', 0)).toBe(true);
    expect(partVisible('caballero', '1H_Sword', 0)).toBe(true);
    expect(partVisible('caballero', 'Round_Shield', 0)).toBe(true);
    for (const m of ['2H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield']) expect(partVisible('caballero', m, 0), m).toBe(false);
    expect(partVisible('barbaro', '1H_Axe', 0)).toBe(true);
    expect(partVisible('barbaro', 'Barbarian_Round_Shield', 0)).toBe(true);
    expect(partVisible('barbaro', 'Mug', 0)).toBe(false);
    expect(partVisible('maga', '1H_Wand', 0)).toBe(true);
    for (const m of ['2H_Staff', 'Spellbook', 'Spellbook_open']) expect(partVisible('maga', m, 0), m).toBe(false);
    expect(partVisible('picaro', 'Knife', 0)).toBe(true);
    for (const m of ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable']) expect(partVisible('picaro', m, 0), m).toBe(false);
  });
  it('a worn hat hides the body\'s own helmet or hat', () => {
    expect(partVisible('caballero', 'Knight_Helmet', 0)).toBe(true);
    expect(partVisible('caballero', 'Knight_Helmet', 3)).toBe(false);
    expect(partVisible('maga', 'Mage_Hat', 2)).toBe(false);
    expect(partVisible('barbaro', 'Barbarian_Hat', 0)).toBe(true);
  });
  it('four bodies', () => expect(BODIES).toEqual(['caballero', 'barbaro', 'maga', 'picaro']));
});

// R3: GLTFLoader sanitizes node names (PropertyBinding.sanitizeNodeName strips '.' and other reserved
// chars), so runtime bone names differ from the source skeleton's dotted names (`upperarm.l` -> `upperarml`).
// Verified once here, against the actual packaged asset, rather than assumed: `poses.ts` and
// `Actor.attachHat` must use exactly the spellings this test confirms.
describe('hero runtime node names (verifies R3 sanitization against the packaged asset)', () => {
  it('heroe-caballero.glb bones and prop nodes keep the names partVisible/poses.ts rely on', async () => {
    // three's GLTFLoader touches `self` while resolving embedded textures; only this test needs it.
    (globalThis as { self?: typeof globalThis }).self ??= globalThis;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    interface FsModule {
      readFileSync(path: string): Uint8Array;
    }
    const fsSpecifier = 'node:fs';
    const { readFileSync }: FsModule = await import(fsSpecifier);
    const bytes = readFileSync('public/models/heroe-caballero.glb');
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const gltf = await new Promise<{ scene: { traverse(cb: (o: { name: string }) => void): void } }>((resolve, reject) => {
      new GLTFLoader().parse(buf, '', resolve, reject);
    });
    const names = new Set<string>();
    gltf.scene.traverse((o) => names.add(o.name));
    for (const n of ['head', 'handslotr', 'handslotl', 'upperarml', 'upperarmr', 'lowerarml', 'lowerarmr', 'upperlegl', 'upperlegr', 'lowerlegl', 'lowerlegr', 'chest']) expect(names.has(n), n).toBe(true);
    for (const n of ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Body']) expect(names.has(n), n).toBe(true);
  });
});
