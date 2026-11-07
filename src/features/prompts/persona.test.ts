import { expect, it } from "vitest";
import { buildMessages, prepareMessages } from "./prompts";
it("sends the user request without an application system prompt", () => {
  const text = "Make this polite: send the files";
  const request = {
    mode: "chat" as const,
    text,
    action: "grammar" as const,
    terms: "",
    instruction: "",
  };
  const messages = buildMessages(request);
  expect(messages).toEqual([{ role: "user", content: text }]);
  expect(prepareMessages(request).messages).toEqual(messages);
  const budget = prepareMessages({ ...request, reasoning: true });
  expect(budget.budget - budget.used).toBeGreaterThan(800);
});
