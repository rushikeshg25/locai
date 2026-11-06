import { afterEach, expect, it, vi } from "vitest";
import { fitSearch, searchWeb, validSource } from "./search";
import { prepareMessages, type WritingRequest } from "./prompts";
import { newConversation } from "./conversations";
import { saveChat, readSaved, exportMarkdown } from "./storage";
const source = {
  title: "Reference",
  url: "https://example.com/",
  snippet: "A useful fact.",
};
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("filters malformed and unsafe results, deduplicates and bounds snippets", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          null,
          { title: "bad", url: "javascript:alert(1)", content: "x" },
          ...Array.from({ length: 6 }, (_, i) => ({
            title: `Result ${i}`,
            url: `https://example.com/${i}`,
            content: `<b>${"x".repeat(400)}</b>`,
          })),
          {
            title: "duplicate",
            url: "https://example.com/0",
            content: "duplicate",
          },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const results = await searchWeb("question", new AbortController().signal);
  expect(results).toHaveLength(4);
  expect(results[0].snippet).toHaveLength(350);
  expect(results[0].snippet).not.toContain("<b>");
  expect(fetcher.mock.calls[0][0]).toBe("/api/search?q=question");
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    cache: "no-store",
  });
  expect(
    validSource({ ...source, url: "https://user:password@example.com" }),
  ).toBe(false);
  expect(
    validSource({ ...source, url: "https://example.com/\n[injection]" }),
  ).toBe(false);
});
it("reports provider failure and empty results instead of inventing evidence", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
  );
  await expect(searchWeb("q", new AbortController().signal)).rejects.toThrow(
    "Too many searches",
  );
  await expect(searchWeb("q", new AbortController().signal)).rejects.toThrow(
    "No usable web results",
  );
});
it("fits complete sources into context and separates untrusted data from instructions", () => {
  const request: WritingRequest = {
    text: "Explain",
    mode: "chat",
    action: "grammar",
    terms: "",
    instruction: "",
    contextWindow: 2800,
  };
  const fitted = fitSearch(
    request,
    Array.from({ length: 4 }, () => ({ ...source, snippet: "x".repeat(200) })),
  );
  expect(fitted.request.webSources!.length).toBeLessThan(4);
  const budget = prepareMessages(fitted.request);
  expect(budget.used).toBeLessThanOrEqual(budget.budget);
  expect(budget.messages[0].content).toContain("untrusted");
  const body = JSON.parse(String(budget.messages.at(-1)!.content));
  expect(body.web_results[0].source).toBe(1);
  expect(body.question).toBe("Explain");
  expect(() =>
    fitSearch({ ...request, text: "x".repeat(3000) }, [source]),
  ).toThrow("not enough context");
});
it("preserves sources when saving and exporting a chat", () => {
  const chat = newConversation();
  chat.messages = [
    {
      id: "reply",
      role: "assistant",
      content: "Fact [1]",
      state: "complete",
      webSearch: true,
      webSources: [source],
      searchQuery: "question",
    },
  ];
  saveChat(chat);
  expect(readSaved().chats[0].messages[0].webSources).toEqual([source]);
  expect(exportMarkdown(chat)).toContain(source.url);
});
it("rejects oversized streamed search JSON before parsing it", async () => {
  const cancel = vi.fn();
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(300_000));
      },
      cancel,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(searchWeb("test", new AbortController().signal)).rejects.toThrow(
    "Search response is too large",
  );
  expect(cancel).toHaveBeenCalled();
});
