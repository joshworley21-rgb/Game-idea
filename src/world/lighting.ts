import * as THREE from "three";
import type { RoomBuild } from "./roomkit.ts";

/** Window light and mood shift with the season, so the term visibly passes. */
const SEASONS = [
  { color: 0xbfd4ea, intensity: 1.1, ambient: 0xd8e2f0 }, // winter
  { color: 0xf6ecd2, intensity: 1.6, ambient: 0xf2ecdc }, // spring
  { color: 0xfff2d2, intensity: 2.0, ambient: 0xfaf2df }, // summer
  { color: 0xf3d9a8, intensity: 1.4, ambient: 0xefe2cb }, // autumn
];

/**
 * Applies the season's light to a room. Called on entry and on every month
 * change, so the window colour tracks the calendar.
 */
export function applySeason(
  room: RoomBuild,
  month: number,
  hemisphere: THREE.HemisphereLight,
): void {
  const season = SEASONS[Math.floor(((month - 1) % 12) / 3) % 4];
  if (room.daylight) {
    room.daylight.color.setHex(season.color);
    room.daylight.intensity = season.intensity * (room.id === "study" ? 0.6 : 1);
  }
  hemisphere.color.setHex(season.ambient);
  for (const light of room.windowLights?.children ?? []) {
    if (light instanceof THREE.PointLight) {
      light.color.setHex(season.color);
      light.intensity = 2.5 + season.intensity * 1.6;
    }
  }
}

/**
 * Adds a diffuse key light anchored to the discovered interior viewpoint.
 * Returns the light so the caller can hold a reference and avoid duplicates.
 */
export function addModelKeyLight(
  scene: THREE.Scene,
  target: THREE.Vector3,
): THREE.DirectionalLight {
  const key = new THREE.DirectionalLight(0xfff2dc, 2.25);
  key.position.set(target.x + 4.5, target.y + 7.5, target.z + 6);
  key.target.position.copy(target);
  key.castShadow = false;
  scene.add(key);
  scene.add(key.target);
  return key;
}
