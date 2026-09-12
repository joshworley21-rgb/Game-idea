export interface ConversationBeat {
  id: string;
  /**
   * Who is talking, or what's happening. A plain string is a caption — the
   * room, a stage direction, a line from nobody in particular. A `Speaker`
   * resolves to a real person with a face, so the panel can show you who you
   * are actually talking to.
   */
  speaker: string | Speaker;
  /** What they say or ask. */
  prompt: string;
  options: ConversationOption[];
}
