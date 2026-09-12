import { resolveSpeaker } from "../game/speaker.ts";
import type { Mood, Speaker } from "../game/speaker.ts";
import type { GameState } from "../game/types.ts";
import { el } from "./dom.ts";
import { portrait } from "./portrait.ts";

/**
 * The speaker block: who is talking, above what they said.
 *
 * A beat used to print a bare string — "The Chief of Staff" — which reads as a
 * caption. This resolves that to the person actually in the job, draws their
 * face from the same seed the room uses, and sets what they said as speech.
 *
 * A plain string still works: it is a stage direction, the room rather than a
 * person, and it is rendered as one.
 */
export function speakerBlock(speaker: string | Speaker, prompt: string, s: GameState): HTMLElement {
  if (typeof speaker === "string") {
    return el("div", {}, [
      el("div", { class: "speaker-stage" }, [speaker]),
      el("div", { class: "speaker-line" }, [prompt]),
    ]);
  }

  const who = resolveSpeaker(speaker, s);

  // The room itself has no face, so it gets the stage treatment even when it
  // is written as a speaker.
  if (!who.isPerson) {
    return el("div", {}, [
      el("div", { class: "speaker-stage" }, [who.name]),
      el("div", { class: "speaker-line" }, [prompt]),
    ]);
  }

  const head = el("div", { class: `speaker mood-${who.mood}` }, [
    portrait(who.seed, {
      age: who.age,
      mood: who.mood,
      dress: who.dress,
      size: 56,
      name: who.name,
    }),
    el("div", { class: "speaker-text" }, [
      el("div", { class: "speaker-name" }, [who.name]),
      who.title ? el("div", { class: "speaker-title" }, [who.title]) : null,
    ]),
  ]);

  return el("div", {}, [head, el("div", { class: "speaker-line" }, [prompt])]);
}

export interface PersonRowOptions {
  seed: string;
  name: string;
  role: string;
  age?: number;
  dress?: string;
  mood?: Mood;
  value?: { text: string; tone: string };
  meta?: string;
  bars?: { label: string; value: number; tone: string }[];
  strain?: { text: string; severe: boolean };
}

/**
 * A person in a roster — the cabinet, the family — with their face, their
 * role, and whatever they are carrying.
 */
export function personRow(opts: PersonRowOptions): HTMLElement {
  const body = el("div", { class: "person-body" }, [
    el("div", { class: "person-name" }, [
      el("span", {}, [opts.name]),
      el("span", { class: "person-role" }, [opts.role]),
      opts.value ? el("span", { class: `person-value v ${opts.value.tone}` }, [opts.value.text]) : null,
    ]),
    opts.meta ? el("div", { class: "person-meta" }, [opts.meta]) : null,
  ]);

  if (opts.bars?.length) {
    const bars = el("div", { class: "person-bars" });
    for (const bar of opts.bars) {
      bars.append(
        el("span", {}, [bar.label]),
        el("div", { class: "meter-track" }, [
          el("div", {
            class: `meter-fill ${bar.tone}`,
            style: `width:${Math.max(0, Math.min(100, bar.value))}%`,
          }),
        ]),
      );
    }
    body.append(bars);
  }

  if (opts.strain) {
    body.append(
      el("div", { class: `person-strain${opts.strain.severe ? " severe" : ""}` }, [opts.strain.text]),
    );
  }

  return el("div", { class: "person-row" }, [
    portrait(opts.seed, {
      age: opts.age,
      mood: opts.mood ?? "neutral",
      dress: opts.dress ?? "suit",
      size: 48,
      name: opts.name,
    }),
    body,
  ]);
}
