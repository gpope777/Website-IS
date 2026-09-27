import * as THREE from 'three';

const RING = new THREE.RingGeometry(1.1, 1.5, 28).rotateX(-Math.PI / 2);
const ARROW = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 1.7), new THREE.Vector2(0.5, 1.7), new THREE.Vector2(0, 3.1)])).rotateX(-Math.PI / 2);
ARROW.scale(1, 1, -1); // shape +y → world +z (the brute's facing)
const MAT = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, fog: false });

/** One red ring and arrow under a brute winding its charge (V2-E, spec §6.2). Only visual: the server times it. */
export function chargeMark(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'charge-mark';
  const ring = new THREE.Mesh(RING, MAT);
  const arrow = new THREE.Mesh(ARROW, MAT);
  ring.renderOrder = arrow.renderOrder = 2;
  g.add(ring, arrow);
  g.position.y = 0.08;
  return g;
}

/** The marks under every charging brute; `targets` are the brutes' roots (their scale is undone: the mark is in metres). */
export class ChargeMarks {
  readonly group = new THREE.Group();
  private readonly marks: THREE.Group[] = [];

  sync(targets: readonly THREE.Object3D[], now: number): void {
    while (this.marks.length < targets.length) {
      const m = chargeMark();
      this.marks.push(m);
      this.group.add(m);
    }
    const pulse = 1 + Math.sin(now * 12) * 0.12;
    this.marks.forEach((m, i) => {
      const t = targets[i];
      m.visible = !!t;
      if (!t) return;
      m.position.set(t.position.x, t.position.y + 0.08, t.position.z);
      m.rotation.y = t.rotation.y;
      m.scale.setScalar(pulse * Math.max(1, t.scale.x * 0.6));
    });
  }
}
