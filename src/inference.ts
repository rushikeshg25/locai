import {
  CreateWebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type WebWorkerMLCEngine,
} from "@mlc-ai/web-llm";
import { buildMessages, type WritingRequest } from "./prompts";
export interface Writer {
  load(
    model: string,
    progress: (value: number, message: string) => void,
  ): Promise<void>;
  generate(
    request: WritingRequest,
    chunk: (text: string) => void,
  ): Promise<{ truncated: boolean }>;
  dispose(): void;
  cached(model: string): Promise<boolean>;
  remove(model: string): Promise<void>;
}
export class LocalWriter implements Writer {
  private worker?: Worker;
  private engine?: WebWorkerMLCEngine;
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
      }),
    );
    if (this.worker !== worker) throw new Error("Model loading was cancelled.");
    this.engine = engine;
  }
  async generate(request: WritingRequest, chunk: (text: string) => void) {
    const engine = this.engine;
    if (!engine) throw new Error("Load a model first.");
    return this.guarded(
      (async () => {
        const stream = await engine.chat.completions.create({
          messages: buildMessages(request),
          stream: true,
          temperature: 0.2,
          max_tokens: 1200,
        });
        let text = "";
        let truncated = false;
        for await (const part of stream) {
          text += part.choices[0]?.delta.content ?? "";
          truncated ||= part.choices[0]?.finish_reason === "length";
          chunk(text);
        }
        if (!text.trim())
          throw new Error("The model returned no text. Try a shorter input.");
        return { truncated };
      })(),
    );
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
