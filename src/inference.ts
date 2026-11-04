import {
  CreateWebWorkerMLCEngine,
  prebuiltAppConfig,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type WebWorkerMLCEngine,
} from "@mlc-ai/web-llm";
import { prepareMessages, type WritingRequest } from "./prompts";
export interface Writer {
  load(
    model: string,
    progress: (value: number, message: string) => void,
  ): Promise<void>;
  generate(
    request: WritingRequest,
    chunk: (text: string) => void,
  ): Promise<{ truncated: boolean }>;
  interrupt?(): void;
  dispose(): void;
  cached(model: string): Promise<boolean>;
  remove(model: string): Promise<void>;
}
export class LocalWriter implements Writer {
  private worker?: Worker;
  private engine?: WebWorkerMLCEngine;
  private interrupted = false;
  private rejectPending?: (error: Error) => void;
  private guarded<T>(operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.rejectPending = reject;
      operation.then(resolve, reject).finally(() => {
        if (this.rejectPending === reject) this.rejectPending = undefined;
      });
    });
  }
  async load(
    model: string,
    progress: (value: number, message: string) => void,
  ) {
    this.dispose();
    const worker = new Worker(
      new URL("./inference.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;
    worker.onerror = () => this.dispose();
    worker.onmessageerror = () => this.dispose();
    const engine = await this.guarded(
      CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: (report) =>
          progress(report.progress, report.text),
        logLevel: "SILENT",
        ...(import.meta.env.VITE_RUNTIME_BASE_URL
          ? {
              appConfig: {
                ...prebuiltAppConfig,
                model_list: prebuiltAppConfig.model_list.map((record) => ({
                  ...record,
                  model_lib: new URL(
                    record.model_lib.split("/").pop()!,
                    new URL(
                      import.meta.env.VITE_RUNTIME_BASE_URL,
                      window.location.href,
                    ),
                  ).href,
                })),
              },
            }
          : {}),
      }),
    );
    if (this.worker !== worker) throw new Error("Model loading was cancelled.");
    this.engine = engine;
  }
  async generate(request: WritingRequest, chunk: (text: string) => void) {
    const engine = this.engine;
    if (!engine) throw new Error("Load a model first.");
    this.interrupted = false;
    return this.guarded(
      (async () => {
        const stream = await engine.chat.completions.create({
          messages: prepareMessages(request).messages,
          stream: true,
          temperature: request.mode === "chat" ? 0.7 : 0.2,
          max_tokens: 1200,
        });
        let text = "";
        let truncated = false;
        for await (const part of stream) {
          text += part.choices[0]?.delta.content ?? "";
          truncated ||= part.choices[0]?.finish_reason === "length";
          chunk(text);
        }
        if (!text.trim() && !this.interrupted)
          throw new Error("The model returned no text. Try a shorter input.");
        return { truncated };
      })(),
    );
  }
  interrupt() {
    this.interrupted = true;
    this.engine?.interruptGenerate();
  }
  dispose() {
    this.rejectPending?.(
      new Error("Inference stopped. Reload the model to try again."),
    );
    this.rejectPending = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.engine = undefined;
  }
  cached(model: string) {
    return hasModelInCache(model);
  }
  async remove(model: string) {
    this.dispose();
    await deleteModelAllInfoInCache(model);
  }
}
