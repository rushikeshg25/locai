import { afterEach, expect, it } from "vitest";
import { splitReasoning } from "./reasoning";
import { conversationHistory, newConversation } from "../chat/conversations";
import { saveChat, readSaved, exportMarkdown } from "../chat/storage";
import { prepareMessages, outputTokenLimit } from "../prompts/prompts";
afterEach(() => localStorage.clear());
it("holds partial tags and separates streamed reasoning from the answer", () => {
  const raw = "<think>Work through it.</think>Final answer.";
  for (let n = 1; n < raw.indexOf("Final"); n++)
    expect(splitReasoning(raw.slice(0, n)).content).toBe("");
  expect(splitReasoning(raw)).toEqual({
    reasoning: "Work through it.",
    content: "Final answer.",
    thinking: false,
  });
  expect(splitReasoning("<think>Partial</thi")).toEqual({
    reasoning: "Partial",
    content: "",
    thinking: true,
  });
  expect(splitReasoning("<think>\n\n</think>\n\nAnswer").content).toBe(
    "Answer",
  );
  expect(splitReasoning("Explain `<think>` tags.").content).toBe(
    "Explain `<think>` tags.",
  );
});
it("retains thinking in saved chats and exports but never includes it in follow-up history", () => {
  const chat = newConversation();
  chat.messages = [
    { id: "u", role: "user", content: "Question", reasoningEnabled: true },
    {
      id: "a",
      role: "assistant",
      content: "Answer",
      reasoning: "Private intermediate text",
      state: "complete",
      thinking: false,
    },
  ];
  saveChat(chat);
  expect(readSaved().chats[0].messages[1].reasoning).toBe(
    "Private intermediate text",
  );
  expect(exportMarkdown(chat)).toContain("### Thinking");
  expect(conversationHistory(chat.messages)[1].content).toBe("Answer");
  chat.messages[1].content = "";
  expect(conversationHistory(chat.messages)).toEqual([]);
});
it("reserves reasoning output space in the same context budget used by generation", () => {
  const request = {
    text: "Hi",
    action: "grammar" as const,
    terms: "",
    instruction: "",
    mode: "chat" as const,
    reasoning: true,
  };
  expect(outputTokenLimit(request)).toBe(2048);
  expect(prepareMessages(request).budget).toBe(4096 - 2048 - 128);
  expect(outputTokenLimit({ ...request, mode: "write" })).toBe(1200);
});

it("rejects malformed saved reasoning metadata", () => {
  const chat = newConversation();
  localStorage.setItem(
    `local-writer-chat-v1:${chat.id}`,
    JSON.stringify({
      ...chat,
      messages: [
        {
          id: "a",
          role: "assistant",
          content: "answer",
          reasoning: { unsafe: true },
        },
      ],
    }),
  );
  expect(readSaved().chats).toHaveLength(0);
  expect(readSaved().warning).not.toBe("");
});

it("keeps native reasoning enabled when search results are fitted to its smaller input budget", async () => {
  const { fitSearch } = await import("../search/search");
  const request = {
    text: "Explain this fact",
    mode: "chat" as const,
    action: "grammar" as const,
    terms: "",
    instruction: "",
    reasoning: true,
  };
  const sources = Array.from({ length: 4 }, (_, i) => ({
    title: `Source ${i}`,
    url: `https://example.com/${i}`,
    snippet: "A fact. ".repeat(40),
  }));
  const fitted = fitSearch(request, sources);
  expect(fitted.request.reasoning).toBe(true);
  expect(fitted.budget.used).toBeLessThanOrEqual(4096 - 2048 - 128);
  expect(fitted.request.webSources.length).toBeGreaterThan(0);
});
