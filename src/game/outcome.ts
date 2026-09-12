/**
 * What the player is shown after doing something.
 *
 * This lived in `engine.ts`, which meant every module that wanted to describe
 * an outcome had to import the engine and risk a cycle. It is a plain shape,
 * so it lives on its own.
 */
export interface Outcome {
  title: string;
  text: string;
  effects: { text: string; good: boolean }[];
  tone: "good" | "bad" | "neutral";
}
