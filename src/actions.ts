export const actions = {
  grammar: {
    label: "Fix grammar",
    instruction:
      "Correct grammar, spelling and punctuation. Make the smallest necessary edits. Preserve wording and tone.",
  },
  casual: {
    label: "Make casual",
    instruction: "Rewrite in natural, friendly, conversational language.",
  },
  professional: {
    label: "Make professional",
    instruction:
      "Rewrite clearly and politely for a professional audience. Avoid unnecessary formality.",
  },
  shorten: {
    label: "Shorten",
    instruction:
      "Remove repetition and unnecessary words. Preserve all important information.",
  },
  summarize: {
    label: "Summarize",
    instruction:
      "Summarize the key points concisely as bullets. Do not add conclusions or details.",
  },
  format: {
    label: "Format",
    instruction:
      "Organize the text into readable paragraphs and bullets. Use checklist items only for explicit tasks. Preserve the content.",
  },
  simplify: {
    label: "Simplify",
    instruction:
      "Use plain words and shorter sentences. Explain jargon only when the source provides enough context. Preserve the original meaning and detail.",
  },
  expand: {
    label: "Expand",
    instruction:
      "Develop the existing ideas into fuller, connected sentences. Add clarity and transitions, but do not invent facts, examples, promises or supporting evidence.",
  },
  direct: {
    label: "Make direct",
    instruction:
      "State the main point and request clearly. Remove unnecessary hedging and filler while preserving genuine uncertainty, politeness and the original commitments.",
  },
  warmer: {
    label: "Make warmer",
    instruction:
      "Use a considerate, approachable tone. Preserve the message and boundaries. Do not add apologies, praise, promises or emotions that the source does not support.",
  },
} as const;
export type Action = keyof typeof actions;
export const MAX_WORDS = 500;
export const MAX_CHARS = 6000;
export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
export function inputError(text: string): string | null {
  if (!text.trim()) return "Paste or type some text first.";
  if (text.length > MAX_CHARS || wordCount(text) > MAX_WORDS)
    return "Use up to 500 words and 6,000 characters. Split longer text into sections.";
  return null;
}

export const primaryActions: Action[] = [
  "grammar",
  "casual",
  "professional",
  "shorten",
  "summarize",
  "format",
];
export const extraActions: Action[] = [
  "simplify",
  "expand",
  "direct",
  "warmer",
];
