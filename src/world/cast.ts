import * as THREE from "three";
import { CharacterAnimator, buildCharacter, buildCrowd } from "./character.ts";
import type { CrowdMember } from "./character.ts";
import type { CastSlot, RoomId } from "./roomkit.ts";
import type { GameState } from "../game/types.ts";

/** The five factions, left to right across the chamber. */
const FACTION_COLOURS = [0x5b7fb4, 0x6a8cbd, 0x87858c, 0xa8836d, 0xb26f68];

/** The three suits used for anonymous crowds outside the chamber. */
const PLAIN_SUITS = [{ suit: 0x6d7382 }, { suit: 0x7a7263 }, { suit: 0x716577 }];

/** A stable key for the current cast, so people are only rebuilt when it changes. */
export function castFingerprint(room: RoomId, state: GameState | null): string {
  if (!state) return `${room}:empty`;
  const cabinet = state.cabinet?.map((c) => c.name).join(",") ?? "";
  const family = state.family?.map((f) => f.name).join(",") ?? "";
  return `${room}|${cabinet}|${family}`;
}

function namedFor(
  slot: CastSlot,
  state: GameState | null,
): { seed: string; age?: number; dress?: "suit" | "smart" | "casual" } | null {
  if (slot.role === "cabinet") {
    const person = state?.cabinet?.[slot.index];
    return person
      ? { seed: person.name, dress: "suit" }
      : { seed: `secretary-${slot.index}`, dress: "suit" };
  }
  if (slot.role === "family") {
    const person = state?.family?.[slot.index];
    if (!person) return null;
    return {
      seed: person.name,
      age: person.age,
      dress: person.kind === "spouse" ? "smart" : "casual",
    };
  }
  return { seed: `aide-${slot.index}`, dress: "suit" };
}

/**
 * Rebuilds the people in a room. Named characters are built individually and
 * animated; anonymous members and press are batched into a crowd.
 */
export function buildCast(
  room: RoomId,
  slots: CastSlot[],
  state: GameState | null,
  people: THREE.Group,
  animator: CharacterAnimator,
): void {
  people.clear();
  animator.clear();
  if (!slots.length) return;

  const crowd: CrowdMember[] = [];
  for (const slot of slots) {
    if (slot.role === "member" || slot.role === "press") {
      crowd.push({
        position: slot.position,
        rotationY: slot.rotationY,
        group: slot.role === "member" ? slot.index : 0,
        seed: Math.round(slot.position.x * 977 + slot.position.z * 131 + slot.position.y * 17),
      });
      continue;
    }
    const person = namedFor(slot, state);
    if (!person) continue;
    const character = buildCharacter({
      seed: person.seed,
      age: person.age,
      dress: person.dress,
      pose: slot.pose,
    });
    character.group.position.copy(slot.position);
    character.group.rotation.y = slot.rotationY;
    people.add(character.group);
    animator.add(character);
  }

  if (crowd.length) {
    const styles = room === "capitol" ? FACTION_COLOURS.map((suit) => ({ suit })) : PLAIN_SUITS;
    people.add(buildCrowd(crowd, styles));
  }
}
