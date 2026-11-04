import { useEffect, useRef, useState } from "react";
import type { Writer } from "./inference";
import type { WritingRequest } from "./prompts";
export function useWriter(writer: Writer) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "writing" | "stopping" | "removing"
  >("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState({ value: 0, message: "" });
  const interrupted = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      generation.current++;
      clearTimeout(timer.current);
      writer.dispose();
    },
    [writer],
  );
  function stop(
    message = "Stopped. Any partial output may be incomplete. Reload the cached model to continue.",
  ) {
    if (status === "writing" && writer.interrupt) {
      interrupted.current = true;
      writer.interrupt();
      setStatus("stopping");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        generation.current++;
        writer.dispose();
        setStatus("idle");
        setNotice(
          "The model did not stop in time and was unloaded. Reload it to continue.",
        );
      }, 5000);
      return;
    }
    generation.current++;
    clearTimeout(timer.current);
    writer.dispose();
    setStatus("idle");
    setNotice(message);
  }
  async function load(model: string) {
    const id = ++generation.current;
    setStatus("loading");
    setError("");
    setNotice("");
    setProgress({
      value: 0,
      message: "Loading runtime files. Waiting for the first download update…",
    });
    timer.current = setTimeout(
      () =>
        stop(
          "Loading timed out. Runtime download or initialization may be stalled. Check your connection and retry.",
        ),
      600_000,
    );
    try {
      await writer.load(model, (value, message) => {
        if (id === generation.current) {
          setProgress({ value, message });
        }
      });
      if (id === generation.current) setStatus("ready");
    } catch (cause) {
      if (id === generation.current) {
        writer.dispose();
        setStatus("idle");
        setError(
          cause instanceof Error
            ? `Could not load the model: ${cause.message.slice(0, 500)}`
            : "Could not load the model. Check connection, available storage and WebGPU support, then retry.",
        );
      }
    } finally {
      if (id === generation.current) clearTimeout(timer.current);
    }
  }
  async function run(
    request: WritingRequest,
    onChunk?: (text: string) => void,
  ): Promise<{
    text: string;
    state: "complete" | "stopped" | "error";
    truncated?: boolean;
  }> {
    let text = "";
    interrupted.current = false;
    const id = ++generation.current;
    setStatus("writing");
    setOutput("");
    setError("");
    setNotice("");
    timer.current = setTimeout(
      () =>
        stop(
          "Generation timed out. Partial output may be incomplete. Try shorter text.",
        ),
      120_000,
    );
    try {
      const result = await writer.generate(request, (chunk) => {
        text = chunk;
        if (id === generation.current) {
          setOutput(text);
          onChunk?.(text);
        }
      });
      if (id === generation.current) {
        setStatus("ready");
        if (result.truncated)
          setNotice(
            "Output reached the model limit and may be incomplete. Try a shorter input.",
          );
      }
      return {
        text,
        state:
          interrupted.current || id !== generation.current
            ? "stopped"
            : "complete",
        truncated: result.truncated,
      };
    } catch (cause) {
      if (id === generation.current) {
        writer.dispose();
        setStatus("idle");
        setError(
          `Generation failed. Your original text is preserved. ${cause instanceof Error ? cause.message.slice(0, 300) : "Reload the model and retry."}`,
        );
      }
      return {
        text,
        state:
          id !== generation.current || interrupted.current
            ? "stopped"
            : "error",
      };
    } finally {
      if (id === generation.current) clearTimeout(timer.current);
    }
  }
  async function remove(model: string) {
    stop("");
    setError("");
    setStatus("removing");
    const id = generation.current;
    try {
      await writer.remove(model);
      if (id === generation.current) setNotice("Selected model cache removed.");
    } catch {
      if (id === generation.current)
        setError(
          "Could not remove all cached model files. Clear this site’s storage in browser settings.",
        );
    } finally {
      if (id === generation.current) setStatus("idle");
    }
  }
  return {
    status,
    output,
    setOutput,
    error,
    notice,
    progress,
    load,
    run,
    stop,
    remove,
  };
}
