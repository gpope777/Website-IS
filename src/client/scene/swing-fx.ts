import * as THREE from 'three';

const TRAIL_SAMPLES = 12;
const MAX_SPARKS = 64;
const SPARK_LIFE = 0.3;

export function trailAlpha(age: number, life: number): number {
  return age >= life ? 0 : Math.max(0, 1 - age / life);
}

type Sample = { base: THREE.Vector3; tip: THREE.Vector3; age: number };
type Spark = { p: THREE.Vector3; v: THREE.Vector3; age: number; color: THREE.Color };

/** One pooled ribbon and one pooled point cloud for every player swing and hit. */
export class SwingFx {
  private readonly trailGeo = new THREE.BufferGeometry();
  private readonly trailMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, vertexColors: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  private readonly trail: THREE.Mesh;
  private trailFrom: THREE.Object3D | null = null;
  private trailLeft = 0;
  private trailColor = new THREE.Color(0xffffff);
  private readonly samples: Sample[] = [];
  private readonly world = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly tip = new THREE.Vector3();

  private readonly sparkGeo = new THREE.BufferGeometry();
  private readonly sparksMesh: THREE.Points;
  private readonly sparksPool: Spark[] = [];

  constructor(scene: THREE.Scene) {
    const positions = new Float32Array(TRAIL_SAMPLES * 2 * 3);
    const colors = new Float32Array(TRAIL_SAMPLES * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < TRAIL_SAMPLES - 1; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.trailGeo.setIndex(indices);
    this.trail = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trail.frustumCulled = false;
    this.trail.visible = false;

    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    this.sparkGeo.setDrawRange(0, 0);
    this.sparksMesh = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ size: 0.11, transparent: true, opacity: 0.9, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.sparksMesh.frustumCulled = false;
    scene.add(this.trail, this.sparksMesh);
  }

  startTrail(from: THREE.Object3D | null, color: number, seconds: number): void {
    if (!from) return;
    this.trailFrom = from;
    this.trailLeft = Math.max(0.05, seconds);
    this.trailColor.setHex(color);
    this.samples.length = 0;
    this.trail.visible = true;
  }

  sparks(at: THREE.Vector3, ring = false): void {
    const count = ring ? 16 : 10;
    const color = new THREE.Color(ring ? 0xbfe6ff : 0xffd24a);
    for (let i = 0; i < count && this.sparksPool.length < MAX_SPARKS; i++) {
      const a = ring ? (i / count) * Math.PI * 2 : Math.random() * Math.PI * 2;
      const speed = ring ? 4 : 2 + Math.random() * 2;
      const up = ring ? 0.4 : 1 + Math.random() * 2;
      this.sparksPool.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * speed, up, Math.sin(a) * speed), age: 0, color: color.clone() });
    }
  }

  update(dt: number): void {
    if (this.trailFrom && this.trailLeft > 0) {
      this.trailLeft -= dt;
      this.trailFrom.getWorldPosition(this.world);
      this.trailFrom.getWorldQuaternion(this.quat);
      this.tip.set(0, 0.6, 0).applyQuaternion(this.quat).add(this.world);
      this.samples.unshift({ base: this.world.clone(), tip: this.tip.clone(), age: 0 });
      if (this.samples.length > TRAIL_SAMPLES) this.samples.length = TRAIL_SAMPLES;
    }
    for (const s of this.samples) s.age += dt;
    while (this.samples.length && this.samples[this.samples.length - 1]!.age >= 0.2) this.samples.pop();
    this.updateTrail();

    for (let i = this.sparksPool.length - 1; i >= 0; i--) {
      const s = this.sparksPool[i]!;
      s.age += dt;
      if (s.age >= SPARK_LIFE) { this.sparksPool.splice(i, 1); continue; }
      s.v.y -= 9.8 * dt;
      s.p.addScaledVector(s.v, dt);
    }
    const pos = this.sparkGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.sparkGeo.getAttribute('color') as THREE.BufferAttribute;
    this.sparksPool.forEach((s, i) => {
      pos.setXYZ(i, s.p.x, s.p.y, s.p.z);
      const a = trailAlpha(s.age, SPARK_LIFE);
      col.setXYZ(i, s.color.r * a, s.color.g * a, s.color.b * a);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.sparkGeo.setDrawRange(0, this.sparksPool.length);
  }

  private updateTrail(): void {
    const pos = this.trailGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.trailGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      const s = this.samples[Math.min(i, this.samples.length - 1)];
      const a = s ? trailAlpha(s.age, 0.2) : 0;
      const base = s?.base ?? this.world;
      const tip = s?.tip ?? this.world;
      pos.setXYZ(i * 2, base.x, base.y, base.z);
      pos.setXYZ(i * 2 + 1, tip.x, tip.y, tip.z);
      col.setXYZ(i * 2, this.trailColor.r * a, this.trailColor.g * a, this.trailColor.b * a);
      col.setXYZ(i * 2 + 1, this.trailColor.r * a, this.trailColor.g * a, this.trailColor.b * a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.trail.visible = this.samples.length > 1;
    if (this.trailLeft <= 0 && this.samples.length === 0) this.trailFrom = null;
  }
}
