import type { Conversation } from "./types.ts";
import { CABINET } from "./conversations/cabinet.ts";
import { INTERVIEW } from "./conversations/interview.ts";
import { CALL_ALLY } from "./conversations/ally.ts";
import { FAMILY_DINNER } from "./conversations/family.ts";

/**
 * Meetings, played out rather than resolved in one click. Each one replaces
 * a flat action of the same name that used to just apply its effects and
 * print a result line — these apply effects beat by beat, and what you say
 * first can open or close what you're offered next.
 *
 * Each meeting lives in its own module under `./conversations/`, so a meeting
 * can be rewritten without touching the others. This is the list the engine
 * reads.
 */
export const CONVERSATIONS: Conversation[] = [CABINET, INTERVIEW, CALL_ALLY, FAMILY_DINNER];

export function conversationById(id: string): Conversation | undefined {
  return CONVERSATIONS.find((c) => c.id === id);
}
