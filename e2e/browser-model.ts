import type { Page } from "@playwright/test";
// Fixture only: exercise the production WebLLM client/worker boundary without
// downloading weights. This does not measure inference quality or GPU support.
export async function installBrowserModel(
  page: Page,
  loadDelay = 0,
  replies?: string[],
  chunkDelay = 0,
  title = "",
) {
  await page.addInitScript(
    ({ loadDelay, replies, chunkDelay, title }) => {
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: { requestAdapter: async () => ({}) },
      });
      const requests: unknown[] = [];
      Object.defineProperty(window, "modelRequests", { value: requests });
      const NativeWorker = window.Worker;
      class ModelWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;
        private emitted = 0;
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
          if (message.kind === "chatCompletionNonStreaming") {
            content = {
              choices: [{ message: { content: title }, finish_reason: "stop" }],
            };
          }
          if (message.kind === "chatCompletionStreamInit") {
            requests.push(message.content.request);
            this.emitted = 0;
          }
          if (
            message.kind === "completionStreamNextChunk" &&
            this.emitted < (replies?.length ?? 1)
          ) {
            const index = this.emitted++;
            content = {
              choices: [
                {
                  delta: {
                    content:
                      replies?.[index] ??
                      "**Hello**\n\n```js\nconst answer = 42;\n```\n\n![image](https://example.com/track)",
                  },
                  finish_reason:
                    this.emitted === (replies?.length ?? 1) ? "stop" : null,
                },
              ],
            };
          }
          setTimeout(
            () => {
              if (!this.closed)
                this.onmessage?.(
                  new MessageEvent("message", {
                    data: { kind: "return", uuid: message.uuid, content },
                  }),
                );
            },
            message.kind === "reload" ? loadDelay : chunkDelay,
          );
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
    },
    { loadDelay, replies, chunkDelay, title },
  );
}
export async function modelRequests(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          modelRequests: {
            messages: { content: string }[];
            extra_body?: { enable_thinking: boolean };
            max_tokens: number;
          }[];
        }
      ).modelRequests,
  );
}
