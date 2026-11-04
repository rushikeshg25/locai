import type { Writer } from "./inference";
import { prepareMessages, type WritingRequest } from "./prompts";
export interface ServerConfig {
  baseURL: string;
  model: string;
  contextWindow: number;
}
export function localEndpoint(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use a local URL such as http://localhost:11434/v1. Credentials and remote hosts are not supported.",
    );
  return url.href.replace(/\/$/, "");
}
export async function listServerModels(
  baseURL: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch(`${localEndpoint(baseURL)}/models`, {
    signal: signal ?? AbortSignal.timeout(15000),
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Model listing failed (HTTP ${response.status}).`);
  const body = await response.json();
  if (!Array.isArray(body.data))
    throw new Error("The server returned an invalid model list.");
  return body.data
    .filter(
      (item: unknown): item is { id: string } =>
        !!item &&
        typeof item === "object" &&
        "id" in item &&
        typeof item.id === "string",
    )
    .map((item: { id: string }) => item.id);
}
export class ServerWriter implements Writer {
  config: ServerConfig = {
    baseURL: "http://localhost:11434/v1",
    model: "",
    contextWindow: 4096,
  };
  private controller?: AbortController;
  private stopped = false;
  configure(config: ServerConfig) {
    this.config = { ...config, baseURL: localEndpoint(config.baseURL) };
  }
  async load(
    model: string,
    progress: (value: number, message: string) => void,
  ) {
    this.dispose();
    this.controller = new AbortController();
    progress(0, "Connecting to local model server…");
    const ids = await listServerModels(
      this.config.baseURL,
      AbortSignal.any([this.controller.signal, AbortSignal.timeout(15000)]),
    );
    if (!ids.includes(model))
      throw new Error("The selected model is not installed on this server.");
    this.config.model = model;
    progress(
      1,
      "Local server connected. The model may warm up on its first reply.",
    );
  }
  async generate(request: WritingRequest, chunk: (text: string) => void) {
    const config = { ...this.config };
    if (!config.model) throw new Error("Connect a model server first.");
    this.controller = new AbortController();
    this.stopped = false;
    const signal = this.controller.signal;
    let text = "",
      truncated = false,
      finished = false;
    try {
      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        redirect: "error",
        signal,
        body: JSON.stringify({
          model: config.model,
          messages: prepareMessages({
            ...request,
            contextWindow: config.contextWindow,
          }).messages,
          stream: true,
          max_tokens: 1200,
          temperature: request.mode === "chat" ? 0.7 : 0.2,
        }),
      });
      if (!response.ok)
        throw new Error(
          `Local server returned HTTP ${response.status}. Check its model and CORS settings.`,
        );
      if (!response.body)
        throw new Error("The server returned no response stream.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      const consume = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) return;
        if (data === "[DONE]") {
          finished = true;
          return;
        }
        const part = JSON.parse(data);
        if (part.error)
          throw new Error(
            "The local server reported an inference error. Check its logs.",
          );
        const choice = part.choices?.[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          chunk(text);
        }
        if (choice?.finish_reason) {
          finished = true;
          truncated ||= choice.finish_reason === "length";
        }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          let match: RegExpExecArray | null;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            consume(buffer.slice(0, match.index));
            buffer = buffer.slice(match.index + match[0].length);
          }
          if (buffer.length > 1_000_000)
            throw new Error("The server sent an oversized stream event.");
          if (done) {
            if (buffer.trim()) consume(buffer);
            break;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (!finished)
        throw new Error(
          "The response stream ended early. Retry to generate a complete answer.",
        );
      if (!text.trim()) throw new Error("The model returned no text.");
      return { truncated };
    } catch (error) {
      if (this.stopped && signal.aborted) return { truncated: false };
      throw error;
    }
  }
  interrupt() {
    this.stopped = true;
    this.controller?.abort();
  }
  dispose() {
    this.controller?.abort();
  }
  async cached() {
    return false;
  }
  async remove() {
    throw new Error("Manage server model files in Ollama or llama.cpp.");
  }
}
