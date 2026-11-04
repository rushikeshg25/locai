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
