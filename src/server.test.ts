import { afterEach, expect, it, vi } from "vitest";
import { ServerWriter, localEndpoint, listServerModels } from "./server";
afterEach(() => vi.unstubAllGlobals());
it("restricts endpoints to loopback and rejects embedded credentials", () => {
  expect(localEndpoint("http://localhost:11434/v1/")).toBe(
    "http://localhost:11434/v1",
  );
  for (const url of [
    "https://example.com/v1",
    "http://user:secret@localhost/v1",
    "file:///x",
    "http://localhost/v1?token=x",
  ])
    expect(() => localEndpoint(url)).toThrow();
});
it("checks models and consumes chunked CRLF SSE with Unicode", async () => {
  const payload =
    'data: {"choices":[{"delta":{"content":"Hi 🌍"}}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(payload);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: "test" }] })),
    )
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < bytes.length; i += 2)
              controller.enqueue(bytes.slice(i, i + 2));
            controller.close();
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const writer = new ServerWriter();
  await writer.load("test", vi.fn());
  const chunk = vi.fn();
  expect(
    await writer.generate(
      {
        text: "hello",
        action: "grammar",
        terms: "",
        instruction: "",
        mode: "chat",
      },
      chunk,
    ),
  ).toEqual({ truncated: true });
  expect(chunk).toHaveBeenLastCalledWith("Hi 🌍");
  expect(JSON.parse(fetch.mock.calls[1][1].body).messages.at(-1).content).toBe(
    "hello",
  );
});
it("reports a failed model-list response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 403 })),
  );
  await expect(listServerModels("http://localhost:11434/v1")).rejects.toThrow(
    "403",
  );
});
it("rejects a stream that ended without a completion marker", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      ),
  );
  const writer = new ServerWriter();
  writer.configure({
    baseURL: "http://localhost:11434/v1",
    model: "test",
    contextWindow: 4096,
  });
  await expect(
    writer.generate(
      { text: "hello", action: "grammar", terms: "", instruction: "" },
      vi.fn(),
    ),
  ).rejects.toThrow("ended early");
});
it("aborts generation without discarding the server configuration", async () => {
  let started!: () => void;
  const pending = new Promise<void>((resolve) => (started = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
          started();
        }),
    ),
  );
  const writer = new ServerWriter();
  writer.configure({
    baseURL: "http://localhost:11434/v1",
    model: "test",
    contextWindow: 4096,
  });
  const running = writer.generate(
    { text: "hello", action: "grammar", terms: "", instruction: "" },
    vi.fn(),
  );
  await pending;
  writer.interrupt();
  await expect(running).resolves.toEqual({ truncated: false });
  expect(writer.config.model).toBe("test");
});
