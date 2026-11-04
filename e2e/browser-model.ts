import type { Page } from "@playwright/test";
// Fixture only: exercise the production WebLLM client/worker boundary without
// downloading weights. This does not measure inference quality or GPU support.
export async function installBrowserModel(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    const requests: unknown[] = [];
    Object.defineProperty(window, "modelRequests", { value: requests });
    const NativeWorker = window.Worker;
    class ModelWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      private emitted = false;
      private closed = false;
      postMessage(message: {
        kind: string;
        uuid: string;
        content: { request?: unknown };
      }) {
        if (
          ["setAppConfig", "setLogLevel", "interruptGenerate"].includes(
            message.kind,
          )
        )
          return;
        let content: unknown;
        if (message.kind === "chatCompletionStreamInit") {
          requests.push(message.content.request);
          this.emitted = false;
        }
        if (message.kind === "completionStreamNextChunk" && !this.emitted) {
          this.emitted = true;
          content = {
            choices: [
              {
                delta: {
                  content:
                    "**Hello**\n\n```js\nconst answer = 42;\n```\n\n![image](https://example.com/track)",
                },
                finish_reason: "stop",
              },
            ],
          };
        }
        queueMicrotask(() => {
          if (!this.closed)
            this.onmessage?.(
              new MessageEvent("message", {
                data: { kind: "return", uuid: message.uuid, content },
              }),
            );
        });
      }
      terminate() {
        this.closed = true;
      }
    }
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        return String(args[0]).includes("inference.worker")
          ? new ModelWorker()
          : Reflect.construct(target, args);
      },
    });
  });
}
export async function modelRequests(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          modelRequests: { messages: { content: string }[] }[];
        }
      ).modelRequests,
  );
}
