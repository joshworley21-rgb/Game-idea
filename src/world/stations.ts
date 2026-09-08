import * as THREE from "three";
import type { StationId } from "../game/types.ts";
import type { StationAnchor } from "./roomkit.ts";

interface StationVisual {
  anchor: StationAnchor;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  /** Invisible volume so a tap or click can open the station directly. */
  hit: THREE.Mesh;
  badge: number;
}

/**
 * The room's interactive points: always tappable, wherever the camera is.
 * No floating label — the legend list and the room's own furniture already
 * say what's here; the ring just marks the spot and glows when something
 * needs you.
 */
export class Stations {
  private visuals: StationVisual[] = [];
  private clock = 0;

  private scene: THREE.Scene;
  private group = new THREE.Group();

  constructor(scene: THREE.Scene, anchors: StationAnchor[]) {
    this.scene = scene;
    this.scene.add(this.group);
    this.rebuild(anchors);
  }

  /** Replaces every marker, for when the president moves to another room. */
  rebuild(anchors: StationAnchor[]): void {
    for (const v of this.visuals) {
      v.ring.geometry.dispose();
      v.ring.material.dispose();
      v.hit.geometry.dispose();
    }
    this.group.clear();
    this.visuals = [];
    for (const anchor of anchors) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 40),
        new THREE.MeshBasicMaterial({
          color: 0xe2c16e,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(anchor.position).setY(0.02);
      this.group.add(ring);

      // Fully transparent rather than `visible: false`, which the raycaster skips.
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 2.4, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.copy(anchor.position).setY(1.2);
      hit.userData.stationId = anchor.id;
      this.group.add(hit);

      this.visuals.push({ anchor, ring, hit, badge: 0 });
    }
  }

  /** Marks a station as demanding attention (a pending crisis, a due budget). */
  setBadge(id: StationId, count: number): void {
    const v = this.visuals.find((s) => s.anchor.id === id);
    if (v) v.badge = count;
  }

  /** Idle pulse on the floor rings, so the room does not feel static. */
  update(dt: number): void {
    this.clock += dt;
    for (const v of this.visuals) {
      const urgent = v.badge > 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * (urgent ? 5 : 2) + v.anchor.position.x);
      v.ring.material.opacity = (urgent ? 0.42 : 0.24) + pulse * (urgent ? 0.35 : 0.14);
      v.ring.material.color.setHex(urgent ? 0xe06a4a : 0xe2c16e);
      v.ring.scale.setScalar(1 + pulse * 0.03);
    }
  }

  /** The station under a screen point, if any. */
  pick(raycaster: THREE.Raycaster): StationId | null {
    const hits = raycaster.intersectObjects(this.visuals.map((v) => v.hit), false);
    const id = hits[0]?.object.userData.stationId;
    return typeof id === "string" ? (id as StationId) : null;
  }

  anchorOf(id: StationId): StationAnchor | null {
    return this.visuals.find((v) => v.anchor.id === id)?.anchor ?? null;
  }
}
