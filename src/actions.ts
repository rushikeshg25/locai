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
