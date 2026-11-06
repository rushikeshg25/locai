import { afterEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  cached: vi.fn(),
}));
vi.mock("@mlc-ai/web-llm", () => ({
  prebuiltAppConfig: {
    model_list: [
      { model_id: "model", model_lib: "https://example.com/runtime.wasm" },
    ],
  },
  CreateWebWorkerMLCEngine: runtime.create,
  deleteModelAllInfoInCache: runtime.remove,
  hasModelInCache: runtime.cached,
}));
import { LocalWriter } from "./inference";
class FakeWorker {
  static last: FakeWorker;
  onerror?: () => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  constructor() {
    FakeWorker.last = this;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("rejects pending initialization when stopped, terminating the worker", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  runtime.create.mockImplementation(() => new Promise(() => {}));
  const writer = new LocalWriter();
  const loading = writer.load("model", vi.fn());
  const rejected = expect(loading).rejects.toThrow(/stopped/);
  writer.dispose();
  await rejected;
  expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
});
it("rejects pending initialization if the worker crashes", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  runtime.create.mockImplementation(() => new Promise(() => {}));
  const writer = new LocalWriter();
  const loading = writer.load("model", vi.fn());
  const rejected = expect(loading).rejects.toThrow(/stopped/);
  FakeWorker.last.onerror?.();
  await rejected;
});
it("streams content and reports a token limit", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  runtime.create.mockResolvedValue({
    chat: {
      completions: {
        create: async function* () {
          yield { choices: [{ delta: { content: "Hello" } }] };
          yield {
            choices: [
              { delta: { content: " world" }, finish_reason: "length" },
            ],
          };
        },
      },
    },
  });
  const writer = new LocalWriter();
  await writer.load("model", vi.fn());
  const chunk = vi.fn();
  expect(
    await writer.generate(
      { text: "hello", action: "grammar", terms: "", instruction: "" },
      chunk,
    ),
  ).toEqual({ truncated: true });
  expect(chunk).toHaveBeenLastCalledWith("Hello world");
  writer.dispose();
});

it("uses the configured local runtime without changing the model identity", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubEnv("VITE_RUNTIME_BASE_URL", "/runtime.local/");
  runtime.create.mockResolvedValue({});
  await new LocalWriter().load("model", vi.fn());
  expect(runtime.create).toHaveBeenCalledWith(
    expect.any(FakeWorker),
    "model",
    expect.objectContaining({
      appConfig: {
        model_list: [
          {
            model_id: "model",
            model_lib: new URL(
              "/runtime.local/runtime.wasm",
              window.location.href,
            ).href,
          },
        ],
      },
    }),
  );
});

it("uses the runtime override for cache checks and removal too", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubEnv("VITE_RUNTIME_BASE_URL", "/runtime.local/");
  runtime.create.mockResolvedValue({});
  const writer = new LocalWriter();
  await writer.load("model", vi.fn());
  const config = runtime.create.mock.calls[0][2].appConfig;
  await writer.cached("model");
  await writer.remove("model");
  expect(runtime.cached).toHaveBeenCalledWith("model", config);
  expect(runtime.remove).toHaveBeenCalledWith("model", config);
});

it("uses native thinking only on supported chat models and disables it for writing", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const create = vi.fn().mockImplementation(async function* () {
    yield {
      choices: [{ delta: { content: "Answer" }, finish_reason: "stop" }],
    };
  });
  runtime.create.mockResolvedValue({ chat: { completions: { create } } });
  const writer = new LocalWriter();
  const request = {
    text: "Question",
    action: "grammar" as const,
    terms: "",
    instruction: "",
    mode: "chat" as const,
    reasoning: true,
  };
  await writer.load("Qwen3-0.6B-q4f16_1-MLC", vi.fn());
  await writer.generate(request, vi.fn());
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      extra_body: { enable_thinking: true },
      max_tokens: 2048,
      temperature: 0.6,
    }),
  );
  await writer.generate({ ...request, reasoning: false }, vi.fn());
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      extra_body: { enable_thinking: false },
      max_tokens: 1200,
    }),
  );
  await writer.generate({ ...request, mode: "write" }, vi.fn());
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({ extra_body: { enable_thinking: false } }),
  );
  await writer.load("model", vi.fn());
  await writer.generate(request, vi.fn());
  expect(create.mock.calls.at(-1)![0]).not.toHaveProperty("extra_body");
  writer.dispose();
});
