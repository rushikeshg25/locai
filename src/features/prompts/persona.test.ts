import { expect, it } from "vitest";
import { LOCAI_SYSTEM_PROMPT } from "./persona";
import { buildMessages, prepareMessages } from "./prompts";
it("keeps Locai's persona in the system role and the user's request unchanged", () => {
  const text = "Make this polite: send the files";
  const request = {
    mode: "chat" as const,
    text,
    action: "grammar" as const,
    terms: "",
    instruction: "",
  };
  const messages = buildMessages(request);
  expect(messages[0]).toEqual({ role: "system", content: LOCAI_SYSTEM_PROMPT });
  expect(messages[1]).toEqual({ role: "user", content: text });
  expect(new TextEncoder().encode(LOCAI_SYSTEM_PROMPT).length).toBeLessThan(
    900,
  );
  const budget = prepareMessages({ ...request, reasoning: true });
  expect(budget.budget - budget.used).toBeGreaterThan(800);
});
