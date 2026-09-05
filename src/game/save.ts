import type { GameState } from "./types.ts";

const KEY = "oval.save.v1";

/** Bills carry predicates, so only their id and status are persisted. */
function serialize(state: GameState): string {
  return JSON.stringify({
    ...state,
    bills: state.bills.map((b) => ({ id: b.id, status: b.status, failedMonth: b.failedMonth })),
  });
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (typeof parsed?.month !== "number" || !parsed.nation) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable; nothing to clear */
  }
}
