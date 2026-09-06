import * as THREE from 'three';
import { Noise2D } from './noise';
import { createRng } from './rng';
import type { ItemId } from './survival';

export const WORLD_SIZE = 480; // metres, square
export const HALF = WORLD_SIZE / 2;

export type ResourceKind = 'tree' | 'rock' | 'bush' | 'mushroom' | 'water';

export interface Resource {
  kind: ResourceKind;
  position: THREE.Vector3;
  radius: number;
  /** Remaining harvests before depletion; water is infinite. */
  uses: number;
  /** Seconds until it regrows; 0 when available. */
  regrow: number;
  object: THREE.Object3D;
  instanceIndex?: number;
  /** Original instance matrix, kept so a depleted resource can regrow. */
  saved?: THREE.Matrix4;
}

export type LandmarkId = 'rock' | 'cabin' | 'circle' | 'tree' | 'pier' | 'cave' | 'exit';

export interface Landmark {
  id: LandmarkId;
  name: string;
  description: string;
  /** Diary fragment left by the forest's previous inhabitant. Shown in the journal. */
  story: string;
  /** One line telling the player what this place does for them. */
  reward: string;
  position: THREE.Vector3;
  discovered: boolean;
  object: THREE.Object3D;
  /** Tall light column that marks the place from afar until it is discovered. */
  beacon: THREE.Mesh;
  /** Visible on the compass. Undiscovered places show only once revealed (Roca del Guardián) or when close. */
  revealed: boolean;
}

export interface Relic {
  name: string;
  lore: string;
  position: THREE.Vector3;
  object: THREE.Object3D;
  found: boolean;
}

export const RELIC_DEFS: { name: string; lore: string }[] = [
  { name: 'Brújula rota', lore: 'La aguja gira sin parar. El ermitaño escribió: «aquí el norte no sirve; sirven los lugares».' },
  { name: 'Cuchara tallada', lore: 'Madera de pino, pulida por años de uso. En el mango: «L.»' },
  { name: 'Página arrancada', lore: '«Día 6. Los lobos no cruzan el fuego. Los otros bichos tampoco, pero sí rodean.»' },
  { name: 'Bota vieja', lore: 'Solo una. La suela está gastada por el lado izquierdo: caminaba en círculos.' },
  { name: 'Anzuelo de hueso', lore: 'Atado con fibra de hierba. Confirma que aprendió a pescar antes que a cazar.' },
  { name: 'Collar de dientes', lore: 'Dientes de lobo, siete. Uno por cada noche que sobrevivió al principio.' },
  { name: 'Frasco vacío', lore: 'Huele a seta. «No comer más de dos al día», dice la etiqueta.' },
  { name: 'Pedernal', lore: 'Marcado con muescas: 31. Los días que tardó en encontrar la puerta.' },
  { name: 'Mapa a carbón', lore: 'Un dibujo tosco: cinco puntos y una flecha hacia el borde. Coincide con tu brújula.' },
  { name: 'Última nota', lore: '«Si cruzas la puerta, cuenta lo que viste. Que nadie más se despierte aquí solo.»' },
];

export type PlaceKind = 'campfire' | 'shelter' | 'house' | 'tower' | 'fence';

export interface Placed {
  kind: PlaceKind;
  position: THREE.Vector3;
  object: THREE.Object3D;
  light?: THREE.PointLight;
}

export const HARVEST: Record<ResourceKind, { item: ItemId; amount: number; uses: number; regrow: number; label: string }> = {
  tree: { item: 'wood', amount: 1, uses: 3, regrow: 240, label: 'Talar árbol' },
  rock: { item: 'stone', amount: 1, uses: 2, regrow: 300, label: 'Recoger piedra' },
  bush: { item: 'berries', amount: 2, uses: 2, regrow: 150, label: 'Recoger bayas' },
  mushroom: { item: 'mushroom', amount: 1, uses: 1, regrow: 200, label: 'Recoger seta' },
  water: { item: 'water', amount: 1, uses: Infinity, regrow: 0, label: 'Beber / llenar agua' },
};

export class World {
  readonly scene = new THREE.Scene();
  readonly resources: Resource[] = [];
  readonly landmarks: Landmark[] = [];
  readonly relics: Relic[] = [];
  readonly placed: Placed[] = [];
  private rain: THREE.Points | null = null;
  raining = false;
  readonly terrain: THREE.Mesh;
  readonly sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.25);
  readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3b5a2a, 0.6);
  readonly fog: THREE.Fog;
  private readonly noise: Noise2D;
  private readonly rng: () => number;
  private readonly heightCache = new Map<string, number>();
  private readonly fiberPatches: THREE.Vector3[] = [];

  constructor(seed: number) {
    this.noise = new Noise2D(seed);
    this.rng = createRng(seed ^ 0x9e3779b9);
    this.fog = new THREE.Fog(0xa8c4b0, 25, 140);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xa8c4b0);

    this.terrain = this.buildTerrain();
    this.scene.add(this.terrain);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun, this.sun.target, this.moon, this.hemi);

    this.buildForest();
    this.buildWater();
    this.buildLandmarks();
    this.buildRelics();
    this.buildSettlements();
  }

  // ---------------------------------------------------------------- terrain

  heightAt(x: number, z: number): number {
    const key = `${(x * 4) | 0}:${(z * 4) | 0}`;
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;
    const n = this.noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
    const ridge = this.noise.fbm(x * 0.004, z * 0.004, 3);
    const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
    const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0; // hills at the border to keep the player in
    let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
    // Guarantee dry, gentle ground at the spawn point regardless of seed.
    const dSpawn = Math.hypot(x, z);
    if (dSpawn < 24) {
      const t = dSpawn / 24;
      h = Math.max(h, 0.8) * (1 - t) + h * t;
    }
    this.heightCache.set(key, h);
    return h;
  }

  /** Vegetation density 0..1: clearings vs dense groves. */
  density(x: number, z: number): number {
    return this.noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
  }

  private buildTerrain(): THREE.Mesh {
    const segments = 240;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x4f7a3a);
    const dark = new THREE.Color(0x2f5a2a);
    const dirt = new THREE.Color(0x6b5a3e);
    const rock = new THREE.Color(0x7d7f7a);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const d = this.density(x, z);
      tmp.copy(grass).lerp(dark, d);
      if (h < -3) tmp.lerp(dirt, Math.min(1, (-3 - h) / 4));
      if (h > 14) tmp.lerp(rock, Math.min(1, (h - 14) / 10));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // ---------------------------------------------------------------- forest

  private buildForest(): void {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.5, 7);
    trunkGeo.translate(0, 2.25, 0);
    const crownGeo = new THREE.ConeGeometry(2.1, 6.5, 8);
    crownGeo.translate(0, 7, 0);
    const crown2Geo = new THREE.ConeGeometry(1.5, 4.5, 8);
    crown2Geo.translate(0, 10.2, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b3f26 });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e6b33 });
    const crown2Mat = new THREE.MeshLambertMaterial({ color: 0x3a7d3d });

    const maxTrees = 6000;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, maxTrees);
    const crowns2 = new THREE.InstancedMesh(crown2Geo, crown2Mat, maxTrees);
    trunks.castShadow = crowns.castShadow = crowns2.castShadow = true;
    crowns.receiveShadow = true;

    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 1100);
    rocks.castShadow = rocks.receiveShadow = true;

    const bushGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 1100);
    bushes.castShadow = true;

    const berryGeo = new THREE.SphereGeometry(0.12, 5, 5);
    const berryMat = new THREE.MeshLambertMaterial({ color: 0xd2342b });
    const berries = new THREE.InstancedMesh(berryGeo, berryMat, 1100 * 4);

    const capGeo = new THREE.ConeGeometry(0.35, 0.25, 8);
    capGeo.translate(0, 0.45, 0);
    const stemGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.4, 6);
    stemGeo.translate(0, 0.2, 0);
    const capMat = new THREE.MeshLambertMaterial({ color: 0xc46b2c });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc4 });
    const caps = new THREE.InstancedMesh(capGeo, capMat, 600);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, 600);

    const grassGeo = new THREE.ConeGeometry(0.25, 0.9, 3);
    grassGeo.translate(0, 0.45, 0);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x7fae4a, side: THREE.DoubleSide });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, 9000);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const p = new THREE.Vector3();
    let ti = 0;
    let ri = 0;
    let bi = 0;
    let bri = 0;
    let mi = 0;
    let gi = 0;

    const spawnClear = 9;
    const step = 4.2;
    for (let x = -HALF + 6; x < HALF - 6; x += step) {
      for (let z = -HALF + 6; z < HALF - 6; z += step) {
        const jx = x + (this.rng() - 0.5) * step;
        const jz = z + (this.rng() - 0.5) * step;
        if (Math.hypot(jx, jz) < spawnClear) continue;
        const h = this.heightAt(jx, jz);
        if (h < -3.2) continue; // water level
        const d = this.density(jx, jz);
        const roll = this.rng();

        if (roll < d * 0.95 && ti < maxTrees && h < 16) {
          const s = 0.8 + this.rng() * 0.7;
          p.set(jx, h - 0.2, jz);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() * Math.PI * 2);
          scale.set(s, s, s);
          m.compose(p, q, scale);
          trunks.setMatrixAt(ti, m);
          crowns.setMatrixAt(ti, m);
          crowns2.setMatrixAt(ti, m);
          this.resources.push({
            kind: 'tree',
            position: new THREE.Vector3(jx, h, jz),
            radius: 0.5 * s,
            uses: HARVEST.tree.uses,
            regrow: 0,
            object: trunks,
            instanceIndex: ti,
          });
          ti++;
        } else if (roll < d * 0.95 + 0.04 && ri < 1100 && h > -2) {
          const s = 0.5 + this.rng() * 0.9;
          p.set(jx, h + 0.15 * s, jz);
          q.setFromEuler(new THREE.Euler(this.rng() * 3, this.rng() * 3, this.rng() * 3));
          scale.set(s * 1.2, s * 0.8, s);
          m.compose(p, q, scale);
          rocks.setMatrixAt(ri, m);
          this.resources.push({
            kind: 'rock',
            position: new THREE.Vector3(jx, h, jz),
            radius: s * 1.1,
            uses: HARVEST.rock.uses,
            regrow: 0,
            object: rocks,
            instanceIndex: ri,
          });
          ri++;
        } else if (roll < d * 0.95 + 0.09 && bi < 1100 && d < 0.6) {
          const s = 0.7 + this.rng() * 0.6;
          p.set(jx, h + 0.5 * s, jz);
          q.identity();
          scale.set(s, s * 0.85, s);
          m.compose(p, q, scale);
          bushes.setMatrixAt(bi, m);
          for (let k = 0; k < 4 && bri < 4400; k++) {
            const a = this.rng() * Math.PI * 2;
            const e = this.rng() * Math.PI - Math.PI / 2;
            p.set(jx + Math.cos(a) * Math.cos(e) * s * 0.9, h + 0.5 * s + Math.sin(e) * s * 0.7, jz + Math.sin(a) * Math.cos(e) * s * 0.9);
            scale.set(1, 1, 1);
            m.compose(p, q, scale);
            berries.setMatrixAt(bri, m);
            bri++;
          }
          this.resources.push({
            kind: 'bush',
            position: new THREE.Vector3(jx, h, jz),
            radius: s,
            uses: HARVEST.bush.uses,
            regrow: 0,
            object: bushes,
            instanceIndex: bi,
          });
          bi++;
        } else if (roll < d * 0.95 + 0.11 && mi < 600 && d > 0.45) {
          p.set(jx, h, jz);
          q.identity();
          const s = 0.8 + this.rng() * 0.6;
          scale.set(s, s, s);
          m.compose(p, q, scale);
          caps.setMatrixAt(mi, m);
          stems.setMatrixAt(mi, m);
          this.resources.push({
            kind: 'mushroom',
            position: new THREE.Vector3(jx, h, jz),
            radius: 0.5,
            uses: 1,
            regrow: 0,
            object: caps,
            instanceIndex: mi,
          });
          mi++;
        } else if (gi < 9000 && d < 0.55 && this.rng() < 0.6) {
          for (let k = 0; k < 3 && gi < 9000; k++) {
            p.set(jx + (this.rng() - 0.5) * 2, this.heightAt(jx, jz) - 0.05, jz + (this.rng() - 0.5) * 2);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() * Math.PI);
            const s = 0.7 + this.rng() * 0.8;
            scale.set(s, s, s);
            m.compose(p, q, scale);
            grass.setMatrixAt(gi, m);
            gi++;
          }
          if (this.rng() < 0.15) this.fiberPatches.push(new THREE.Vector3(jx, this.heightAt(jx, jz), jz));
        }
      }
    }

    trunks.count = crowns.count = crowns2.count = ti;
    rocks.count = ri;
    bushes.count = bi;
    berries.count = bri;
    caps.count = stems.count = mi;
    grass.count = gi;
    for (const im of [trunks, crowns, crowns2, rocks, bushes, berries, caps, stems, grass]) {
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.scene.add(im);
    }
    this.berriesMesh = berries;
    this.treeMeshes = [trunks, crowns, crowns2];
  }

  private berriesMesh!: THREE.InstancedMesh;
  private treeMeshes: THREE.InstancedMesh[] = [];

  /** Tall grass patches where fiber can be gathered (no visual marker; found by walking). */
  nearestFiber(pos: THREE.Vector3, maxDist = 2.5): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bd = maxDist;
    for (const f of this.fiberPatches) {
      const d = Math.hypot(f.x - pos.x, f.z - pos.z);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- water

  private buildWater(): void {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -3.2;
    water.name = 'water';
    this.scene.add(water);

    // Sample shoreline spots to act as drinkable resources.
    for (let x = -HALF + 8; x < HALF - 8; x += 6) {
      for (let z = -HALF + 8; z < HALF - 8; z += 6) {
        const h = this.heightAt(x, z);
        if (h < -3.2 && h > -4.4) {
          this.resources.push({
            kind: 'water',
            position: new THREE.Vector3(x, -3.2, z),
            radius: 3,
            uses: Infinity,
            regrow: 0,
            object: water,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------- structures

  private static readonly WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  private static readonly DARKWOOD = new THREE.MeshLambertMaterial({ color: 0x3b2a1c });
  private static readonly STONE = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });

  /** Log hut with a pitched roof, a door gap on the +z side and a chimney. */
  static house(rng: () => number = Math.random): THREE.Group {
    const g = new THREE.Group();
    const w = 5 + rng() * 2;
    const d = 4 + rng() * 2;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), World.WOOD);
    walls.position.y = 1.4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.85, 2.2, 4), World.DARKWOOD);
    roof.position.y = 3.9;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.2), new THREE.MeshBasicMaterial({ color: 0x100a06 }));
    door.position.set(0, 1, d / 2 + 0.05);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), World.STONE);
    chimney.position.set(w * 0.3, 4.2, -d * 0.2);
    g.add(walls, roof, door, chimney);
    return g;
  }

  /** Four-post watchtower with a platform and a little roof on top. */
  static tower(): THREE.Group {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 8), World.WOOD);
      post.position.set(dx, 4, dz);
      g.add(post);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), World.WOOD);
    deck.position.y = 8;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), World.DARKWOOD);
    roof.position.y = 9.6;
    roof.rotation.y = Math.PI / 4;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 3.4), new THREE.MeshLambertMaterial({ color: 0x6b4a2e, transparent: true, opacity: 0.45 }));
    rail.position.y = 8.6;
    g.add(deck, roof, rail);
    return g;
  }

  /** Two posts and two rails, 4 m long along x. */
  static fence(): THREE.Group {
    const g = new THREE.Group();
    for (const dx of [-2, 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), World.WOOD);
      post.position.set(dx, 0.65, 0);
      g.add(post);
    }
    for (const y of [0.5, 1.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.1), World.WOOD);
      rail.position.y = y;
      g.add(rail);
    }
    return g;
  }

  static well(): THREE.Group {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true, side: THREE.DoubleSide }));
    ring.position.y = 0.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), World.DARKWOOD);
    roof.position.y = 2.7;
    roof.rotation.y = Math.PI / 4;
    for (const dx of [-0.9, 0.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), World.WOOD);
      post.position.set(dx, 1.2, 0);
      g.add(post);
    }
    g.add(ring, roof);
    return g;
  }

  /** Broken walls of a stone ruin. */
  static ruin(rng: () => number): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const h = 0.8 + rng() * 2.2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.7 : 5, h, i % 2 ? 5 : 0.7), World.STONE);
      wall.position.set(i === 1 ? 2.5 : i === 3 ? -2.5 : 0, h / 2, i === 0 ? -2.5 : i === 2 ? 2.5 : 0);
      g.add(wall);
    }
    return g;
  }

  /** Plank bridge: a deck just above the water with posts at both ends. */
  static bridge(length: number): THREE.Group {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.25, 2.4), World.WOOD);
    deck.position.y = -2.2;
    g.add(deck);
    for (const dx of [-length / 2 + 0.3, length / 2 - 0.3]) {
      for (const dz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3), World.WOOD);
        post.position.set(dx, -3.2, dz);
        g.add(post);
      }
    }
    return g;
  }

  /**
   * Abandoned infrastructure on dry land: three hamlets (huts, well, fence, tower),
   * a handful of lone ruins and watchtowers, and plank bridges over narrow water.
   * Props only: no discovery, no lore. ponytail: no collision, walk-through like the cabin.
   */
  private buildSettlements(): void {
    const dry = (x: number, z: number) => { const h = this.heightAt(x, z); return h > -2 && h < 14; };
    const put = (obj: THREE.Object3D, x: number, z: number, rot = this.rng() * Math.PI * 2, clear = 6) => {
      obj.position.set(x, this.heightAt(x, z), z);
      obj.rotation.y = rot;
      obj.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
      this.scene.add(obj);
      this.clearResourcesNear(x, z, clear);
    };
    const pick = (): [number, number] | null => {
      for (let i = 0; i < 40; i++) {
        const x = (this.rng() - 0.5) * WORLD_SIZE * 0.85;
        const z = (this.rng() - 0.5) * WORLD_SIZE * 0.85;
        if (Math.hypot(x, z) < 45 || !dry(x, z)) continue;
        if (this.landmarks.some((l) => Math.hypot(l.position.x - x, l.position.z - z) < 40)) continue;
        return [x, z];
      }
      return null;
    };
    for (let s = 0; s < 3; s++) {
      const c = pick();
      if (!c) continue;
      const [cx, cz] = c;
      const huts = 3 + Math.floor(this.rng() * 3);
      for (let i = 0; i < huts; i++) {
        const a = (i / huts) * Math.PI * 2 + this.rng() * 0.5;
        const r = 10 + this.rng() * 6;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (dry(x, z)) put(World.house(this.rng), x, z, -a + Math.PI / 2);
      }
      put(World.well(), cx, cz, 0, 3);
      if (dry(cx + 20, cz + 4)) put(World.tower(), cx + 20, cz + 4, 0, 3);
      for (let i = 0; i < 5; i++) {
        const x = cx - 22 + i * 4.2;
        if (dry(x, cz - 18)) put(World.fence(), x, cz - 18, 0, 1);
      }
    }
    for (let i = 0; i < 6; i++) {
      const c = pick();
      if (!c) continue;
      put(i % 2 ? World.tower() : World.ruin(this.rng), c[0], c[1]);
    }
    // Bridges: scan a coarse grid for spots where 10-20 m of water lie between two dry banks.
    let bridges = 0;
    for (let x = -HALF + 20; x < HALF - 20 && bridges < 4; x += 12) {
      for (let z = -HALF + 20; z < HALF - 20 && bridges < 4; z += 12) {
        if (this.heightAt(x, z) > -3.2) continue;
        for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
          let len = 0;
          while (len < 22 && this.heightAt(x + dx * len, z + dz * len) < -3.2) len += 2;
          if (len < 10 || len >= 22) continue;
          if (this.heightAt(x - dx * 2, z - dz * 2) < -2.8 || this.heightAt(x + dx * (len + 2), z + dz * (len + 2)) < -2.8) continue;
          const b = World.bridge(len + 4);
          b.position.set(x + (dx * len) / 2, 0, z + (dz * len) / 2);
          b.rotation.y = dz ? Math.PI / 2 : 0;
          b.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
          this.scene.add(b);
          bridges++;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- landmarks

  private static beacon(color: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.35, 1.2, 90, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 45;
    m.renderOrder = 5;
    return m;
  }

  private buildLandmarks(): void {
    const defs: { id: LandmarkId; name: string; description: string; story: string; reward: string; build: () => THREE.Object3D }[] = [
      {
        id: 'rock',
        name: 'Roca del Guardián',
        description: 'Un monolito gris que se alza sobre las copas. Desde aquí se ve casi todo el bosque.',
        story: '«Día 3. Subí a la roca. Desde arriba conté los lugares: una cabaña, un anillo de piedras, un árbol enorme, el muelle y una boca negra en la ladera. Los apunté todos.»',
        reward: 'El mapa mental del explorador: todos los lugares aparecen en tu brújula.',
        build: () => {
          const g = new THREE.Group();
          const mat = new THREE.MeshLambertMaterial({ color: 0x6d6f6a, flatShading: true });
          const base = new THREE.Mesh(new THREE.DodecahedronGeometry(4, 0), mat);
          base.position.y = 2;
          const spire = new THREE.Mesh(new THREE.ConeGeometry(2, 14, 6), mat);
          spire.position.y = 9;
          g.add(base, spire);
          return g;
        },
      },
      {
        id: 'cabin',
        name: 'Cabaña abandonada',
        description: 'Las paredes aún aguantan. Alguien vivió aquí hace mucho tiempo.',
        story: '«Día 1. Me desperté igual que tú, sin recordar nada. Levanté estas paredes con un hacha que encontré en el musgo. Dejo la caja para el próximo.»',
        reward: 'Una caja con provisiones: hacha, madera, fibra y una antorcha.',
        build: () => {
          const g = new THREE.Group();
          const wood = new THREE.MeshLambertMaterial({ color: 0x5a3f2a });
          const walls = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), wood);
          walls.position.y = 1.5;
          const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.5, 4), new THREE.MeshLambertMaterial({ color: 0x3b2a1c }));
          roof.position.y = 4.2;
          roof.rotation.y = Math.PI / 4;
          g.add(walls, roof);
          return g;
        },
      },
      {
        id: 'circle',
        name: 'Círculo de piedras',
        description: 'Siete piedras clavadas en un anillo perfecto. Nadie recuerda quién las puso.',
        story: '«Día 9. Dentro del anillo las heridas cierran solas y los bichos no entran. No sé qué es. No pregunto.»',
        reward: 'Dentro del anillo recuperas salud y las criaturas no se atreven a entrar.',
        build: () => {
          const g = new THREE.Group();
          const mat = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });
          for (let i = 0; i < 7; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.6), mat);
            const a = (i / 7) * Math.PI * 2;
            s.position.set(Math.cos(a) * 4, 1.2, Math.sin(a) * 4);
            s.rotation.y = -a;
            g.add(s);
          }
          return g;
        },
      },
      {
        id: 'tree',
        name: 'Árbol Anciano',
        description: 'Un tronco tan ancho que cinco personas no lo abrazarían. El bosque nació aquí.',
        story: '«Día 14. Los frutos del árbol grande no se acaban nunca. Con esto aguanto. Pero cada noche hay más ojos entre los troncos.»',
        reward: 'Frutos que vuelven a crecer: pulsa E junto al tronco.',
        build: () => {
          const g = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 12, 9), new THREE.MeshLambertMaterial({ color: 0x4a3120 }));
          trunk.position.y = 6;
          const crown = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2b5e2f }));
          crown.position.y = 14;
          g.add(trunk, crown);
          return g;
        },
      },
      {
        id: 'pier',
        name: 'Mirador del Lago',
        description: 'Una plataforma de madera sobre el agua. Buen sitio para pescar, si supieras cómo.',
        story: '«Día 20. Con fibra y paciencia se pesca. Desde el muelle vi la salida: al borde del bosque, donde las colinas se abren. Solo la ves cuando conoces todo lo demás.»',
        reward: 'Pesca desde el muelle: pulsa E mirando al agua.',
        build: () => {
          const g = new THREE.Group();
          const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
          const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 4), wood);
          deck.position.y = 1;
          for (const [dx, dz] of [[-2.5, -1.5], [2.5, -1.5], [-2.5, 1.5], [2.5, 1.5]] as const) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3), wood);
            post.position.set(dx, 0, dz);
            g.add(post);
          }
          g.add(deck);
          return g;
        },
      },
      {
        id: 'cave',
        name: 'Cueva del Ermitaño',
        description: 'Una boca negra en la ladera. Dentro no llueve, no hace viento y no llega la noche.',
        story: '«Día 27. Llevo días sin salir de la cueva. Aquí no hace frío. Si lees esto, no cometas mi error: no te quedes. Encuentra los cinco lugares y busca la puerta.»',
        reward: 'Refugio natural: dentro no pierdes calor y descansas rápido.',
        build: () => {
          const g = new THREE.Group();
          const rock = new THREE.MeshLambertMaterial({ color: 0x55534f, flatShading: true });
          const mound = new THREE.Mesh(new THREE.SphereGeometry(6, 9, 7), rock);
          mound.position.y = 1;
          mound.scale.set(1.3, 0.8, 1);
          const mouth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 5, 10), new THREE.MeshBasicMaterial({ color: 0x050505 }));
          mouth.rotation.z = Math.PI / 2;
          mouth.position.set(6, 1.6, 0);
          g.add(mound, mouth);
          return g;
        },
      },
    ];

    for (const def of defs) {
      let x = 0;
      let z = 0;
      let h = 0;
      for (let attempt = 0; attempt < 60; attempt++) {
        x = (this.rng() - 0.5) * WORLD_SIZE * 0.8;
        z = (this.rng() - 0.5) * WORLD_SIZE * 0.8;
        h = this.heightAt(x, z);
        const wantWater = def.id === 'pier';
        const okHeight = wantWater ? h < -2.5 && h > -4.5 : def.id === 'cave' ? h > 4 && h < 18 : h > -2.5 && h < 15;
        const farFromSpawn = Math.hypot(x, z) > 40;
        const farFromOthers = this.landmarks.every((l) => l.position.distanceTo(new THREE.Vector3(x, h, z)) > 50);
        if (okHeight && farFromSpawn && farFromOthers) break;
      }
      const obj = def.build();
      obj.position.set(x, Math.max(h, -3.2), z);
      obj.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
      });
      const beacon = World.beacon(def.id === 'cave' ? 0x9fd8ff : 0xffe9a0);
      obj.add(beacon);
      this.scene.add(obj);
      this.clearResourcesNear(x, z, 8);
      this.landmarks.push({ ...def, position: obj.position.clone(), discovered: false, object: obj, beacon, revealed: false });
    }
  }

  /** Ten small glowing keepsakes scattered on dry land, a few near landmarks. */
  private buildRelics(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    const ring = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    RELIC_DEFS.forEach((def, i) => {
      let x = 0;
      let z = 0;
      let h = -99;
      for (let attempt = 0; attempt < 60; attempt++) {
        const l = this.landmarks[i];
        if (l) {
          const a = this.rng() * Math.PI * 2;
          x = l.position.x + Math.cos(a) * 18;
          z = l.position.z + Math.sin(a) * 18;
        } else {
          x = (this.rng() - 0.5) * WORLD_SIZE * 0.75;
          z = (this.rng() - 0.5) * WORLD_SIZE * 0.75;
        }
        h = this.heightAt(x, z);
        if (h > -2.5 && h < 16 && Math.hypot(x, z) > 25) break;
      }
      const g = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat);
      gem.position.y = 0.9;
      gem.name = 'gem';
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 6, 6, 1, true), ring);
      halo.position.y = 3;
      g.add(gem, halo);
      g.position.set(x, Math.max(h, -3.2), z);
      this.scene.add(g);
      this.relics.push({ ...def, position: g.position.clone(), object: g, found: false });
    });
  }

  /** Closest unfound relic within `r`, or null. */
  relicNear(pos: THREE.Vector3, r: number): Relic | null {
    let best: Relic | null = null;
    let bd = r;
    for (const rel of this.relics) {
      if (rel.found) continue;
      const d = Math.hypot(rel.position.x - pos.x, rel.position.z - pos.z);
      if (d < bd) {
        bd = d;
        best = rel;
      }
    }
    return best;
  }

  collectRelic(rel: Relic): void {
    rel.found = true;
    rel.object.visible = false;
  }

  /** Mark a landmark as found: the beacon fades out over a few seconds (see animate). */
  discover(l: Landmark): void {
    l.discovered = true;
    l.revealed = true;
  }

  /** The exit appears at the edge of the forest once every other place is known. */
  revealExit(): Landmark {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0xbfb9a8, flatShading: true });
    for (const dx of [-3, 3]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), stone);
      pillar.position.set(dx, 4.5, 0);
      g.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.2, 1.4), stone);
    lintel.position.y = 9.4;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 8.6), new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }));
    glow.position.y = 4.4;
    glow.name = 'glow';
    g.add(lintel, glow);
    let x = 0;
    let z = 0;
    let h = -99;
    for (let attempt = 0; attempt < 80 && h < -2; attempt++) {
      const a = this.rng() * Math.PI * 2;
      const r = WORLD_SIZE * 0.42;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      h = this.heightAt(x, z);
    }
    g.position.set(x, Math.max(h, -3.2), z);
    g.rotation.y = Math.atan2(x, z);
    const beacon = World.beacon(0xffffff);
    g.add(beacon);
    this.scene.add(g);
    this.clearResourcesNear(x, z, 8);
    const l: Landmark = {
      id: 'exit',
      name: 'Puerta del Bosque',
      description: 'Dos pilares de piedra al borde de las colinas. Detrás, el camino a casa.',
      story: '«Si has llegado hasta aquí, ya sabes más del bosque que yo. Cruza. No mires atrás.»',
      reward: 'La salida. Cruzarla termina tu aventura con la máxima puntuación.',
      position: g.position.clone(),
      discovered: false,
      object: g,
      beacon,
      revealed: true,
    };
    this.landmarks.push(l);
    return l;
  }

  /** Rain is a cloud of falling points that follows the player. */
  setRain(on: boolean, playerPos: THREE.Vector3, dt: number): void {
    if (on && !this.rain) {
      const n = 1800;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = Math.random() * 30;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe3f5, size: 0.12, transparent: true, opacity: 0.6 }));
      this.scene.add(this.rain);
    }
    this.raining = on;
    if (!this.rain) return;
    this.rain.visible = on;
    if (!on) return;
    this.rain.position.set(playerPos.x, playerPos.y, playerPos.z);
    const arr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) {
      let y = arr.getY(i) - 22 * dt;
      if (y < -2) y += 30;
      arr.setY(i, y);
    }
    arr.needsUpdate = true;
  }

  /** Landmark whose centre is within `r` of a point, or null. */
  landmarkNear(pos: THREE.Vector3, r: number): Landmark | null {
    for (const l of this.landmarks) if (Math.hypot(l.position.x - pos.x, l.position.z - pos.z) < r) return l;
    return null;
  }

  private clearResourcesNear(x: number, z: number, r: number): void {
    for (const res of this.resources) {
      if (res.kind === 'water') continue;
      if (Math.hypot(res.position.x - x, res.position.z - z) < r) {
        this.hideInstance(res);
        res.uses = 0;
        res.regrow = Infinity;
      }
    }
  }

  // ---------------------------------------------------------------- resource state

  private hideInstance(res: Resource): void {
    if (res.instanceIndex === undefined) return;
    const im = res.object as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    im.getMatrixAt(res.instanceIndex, m);
    if (!res.saved) res.saved = m.clone();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    // Trees have three instanced meshes sharing the same index.
    const meshes = res.kind === 'tree' ? this.treeMeshes : [im];
    for (const mesh of meshes) {
      mesh.setMatrixAt(res.instanceIndex, zero);
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (res.kind === 'bush') this.setBerriesVisible(res, false);
  }

  private berrySaved = new Map<number, THREE.Matrix4>();

  /** Bushes keep their leaves; only the berries appear and disappear. */
  private setBerriesVisible(res: Resource, visible: boolean): void {
    if (res.instanceIndex === undefined) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const idx = res.instanceIndex * 4 + k;
      if (visible) {
        const saved = this.berrySaved.get(idx);
        if (saved) this.berriesMesh.setMatrixAt(idx, saved);
      } else {
        if (!this.berrySaved.has(idx)) {
          const m = new THREE.Matrix4();
          this.berriesMesh.getMatrixAt(idx, m);
          this.berrySaved.set(idx, m);
        }
        this.berriesMesh.setMatrixAt(idx, zero);
      }
    }
    this.berriesMesh.instanceMatrix.needsUpdate = true;
  }

  private restoreBerries(res: Resource): void {
    this.setBerriesVisible(res, true);
  }

  private showInstance(res: Resource): void {
    if (res.instanceIndex === undefined || !res.saved) return;
    const im = res.object as THREE.InstancedMesh;
    const meshes = res.kind === 'tree' ? this.treeMeshes : [im];
    for (const mesh of meshes) {
      mesh.setMatrixAt(res.instanceIndex, res.saved);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Harvest a resource. Returns false if depleted. Trees take one use per hit and only vanish when empty. */
  harvest(res: Resource): boolean {
    if (res.uses <= 0) return false;
    if (res.kind === 'water') return true;
    res.uses -= 1;
    if (res.uses <= 0) {
      res.regrow = HARVEST[res.kind].regrow;
      if (res.kind === 'bush') {
        this.setBerriesVisible(res, false);
      } else {
        this.hideInstance(res);
      }
    }
    return true;
  }

  update(dt: number): void {
    for (const res of this.resources) {
      if (res.regrow > 0 && Number.isFinite(res.regrow)) {
        res.regrow -= dt;
        if (res.regrow <= 0) {
          res.regrow = 0;
          res.uses = HARVEST[res.kind].uses;
          if (res.kind === 'bush') this.restoreBerries(res);
          else this.showInstance(res);
        }
      }
    }
  }

  /** Closest usable resource within reach of a point and roughly along a direction. */
  findInteractable(from: THREE.Vector3, dir: THREE.Vector3, reach = 3.2): Resource | null {
    let best: Resource | null = null;
    let bestScore = Infinity;
    const to = new THREE.Vector3();
    for (const res of this.resources) {
      if (res.uses <= 0) continue;
      to.subVectors(res.position, from);
      const flat = Math.hypot(to.x, to.z);
      if (flat > reach + res.radius) continue;
      if (Math.abs(to.y) > 4) continue;
      to.y = 0;
      to.normalize();
      const facing = to.x * dir.x + to.z * dir.z;
      if (flat > 1.2 && facing < 0.3) continue;
      const score = flat - facing;
      if (score < bestScore) {
        bestScore = score;
        best = res;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- placing

  place(kind: PlaceKind, at: THREE.Vector3, facing: number): Placed {
    const y = this.heightAt(at.x, at.z);
    const group = new THREE.Group();
    let light: THREE.PointLight | undefined;
    if (kind === 'campfire') {
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x77776f, flatShading: true });
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), stoneMat);
        const a = (i / 8) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9);
        group.add(s);
      }
      const logMat = new THREE.MeshLambertMaterial({ color: 0x4a3120 });
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 3) * Math.PI;
        log.position.y = 0.15;
        group.add(log);
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.1, 7),
        new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9 }),
      );
      flame.position.y = 0.7;
      flame.name = 'flame';
      group.add(flame);
      light = new THREE.PointLight(0xff9a3c, 30, 22, 1.6);
      light.position.y = 1.2;
      light.castShadow = false;
      group.add(light);
    } else if (kind === 'shelter') {
      const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
      const leaf = new THREE.MeshLambertMaterial({ color: 0x3f6d34, side: THREE.DoubleSide });
      const a = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 2.8), leaf);
      a.position.set(-1.05, 1.15, 0);
      a.rotation.z = Math.PI / 3.2;
      const b = a.clone();
      b.position.x = 1.05;
      b.rotation.z = -Math.PI / 3.2;
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), wood);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.y = 2.1;
      group.add(a, b, ridge);
    } else if (kind === 'house') group.add(World.house(this.rng));
    else if (kind === 'tower') group.add(World.tower());
    else group.add(World.fence());
    group.position.set(at.x, y, at.z);
    group.rotation.y = facing;
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.scene.add(group);
    const placed: Placed = { kind, position: group.position.clone(), object: group, light };
    this.placed.push(placed);
    return placed;
  }

  nearPlaced(kind: PlaceKind, pos: THREE.Vector3, dist: number): boolean {
    return this.placed.some((p) => p.kind === kind && Math.hypot(p.position.x - pos.x, p.position.z - pos.z) < dist);
  }

  // ---------------------------------------------------------------- lighting

  /** dayFraction 0..1 (0 midnight). */
  setTimeOfDay(f: number, playerPos: THREE.Vector3): void {
    const angle = (f - 0.25) * Math.PI * 2; // sunrise at 0.25
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(playerPos.x + sunX * 120, playerPos.y + sunY * 120, playerPos.z + 40);
    this.sun.target.position.copy(playerPos);
    this.moon.position.set(playerPos.x - sunX * 120, playerPos.y - sunY * 120, playerPos.z - 40);

    const daylight = Math.max(0, Math.min(1, (sunY + 0.15) / 0.5));
    this.sun.intensity = 2.4 * daylight;
    this.moon.intensity = 0.3 * (1 - daylight);
    this.hemi.intensity = 0.15 + 0.6 * daylight;

    const dusk = 1 - Math.abs(sunY) > 0.85 && sunY > -0.2 ? 1 - Math.abs(sunY) - 0.85 : 0;
    const day = new THREE.Color(0xa8c8d8);
    const night = new THREE.Color(0x0b1220);
    const orange = new THREE.Color(0xd9865a);
    const sky = night.clone().lerp(day, daylight).lerp(orange, Math.min(1, dusk * 4) * 0.6);
    (this.scene.background as THREE.Color).copy(sky);
    this.fog.color.copy(sky);
    const rainMul = this.raining ? 0.55 : 1;
    this.fog.near = (20 + 20 * daylight) * rainMul;
    this.fog.far = (60 + 100 * daylight) * rainMul;
    if (this.raining) (this.scene.background as THREE.Color).multiplyScalar(0.75);
    this.fog.color.copy(this.scene.background as THREE.Color);
    this.sun.color.set(daylight > 0.6 ? 0xfff2d8 : 0xffb070);
  }

  animate(t: number): void {
    for (const r of this.relics) {
      if (r.found) continue;
      const gem = r.object.getObjectByName('gem');
      if (gem) {
        gem.rotation.y = t * 1.5;
        gem.position.y = 0.9 + Math.sin(t * 2 + r.position.x) * 0.15;
      }
    }
    for (const l of this.landmarks) {
      const mat = l.beacon.material as THREE.MeshBasicMaterial;
      if (l.discovered) {
        if (mat.opacity > 0) mat.opacity = Math.max(0, mat.opacity - 0.004);
        l.beacon.visible = mat.opacity > 0;
      } else {
        mat.opacity = 0.28 + Math.sin(t * 1.5 + l.position.x) * 0.1;
        l.beacon.rotation.y = t * 0.3;
      }
    }
    for (const p of this.placed) {
      if (p.kind !== 'campfire') continue;
      const flame = p.object.getObjectByName('flame');
      if (flame) {
        const s = 0.9 + Math.sin(t * 13 + p.position.x) * 0.12 + Math.sin(t * 7.3) * 0.08;
        flame.scale.set(s, 0.8 + Math.sin(t * 9.1) * 0.2, s);
      }
      if (p.light) p.light.intensity = 28 + Math.sin(t * 17) * 3 + Math.sin(t * 5.7) * 2;
    }
  }
}
