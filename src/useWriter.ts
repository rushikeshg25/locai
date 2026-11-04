import { useEffect, useRef, useState } from "react";
import type { Writer } from "./inference";
import type { WritingRequest } from "./prompts";
export function useWriter(writer: Writer) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "writing" | "removing"
  >("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState({ value: 0, message: "" });
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
    setProgress({ value: 0, message: "Starting…" });
    timer.current = setTimeout(
      () => stop("Loading timed out. Check your connection and retry."),
      600_000,
    );
    try {
      await writer.load(model, (value, message) => {
        if (id === generation.current) setProgress({ value, message });
      });
      if (id === generation.current) setStatus("ready");
    } catch {
      if (id === generation.current) {
        writer.dispose();
        setStatus("idle");
        setError(
          "Could not load the model. Check connection, available storage and WebGPU support, then retry.",
        );
      }
    } finally {
      if (id === generation.current) clearTimeout(timer.current);
    }
  }
  async function run(request: WritingRequest) {
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
      const result = await writer.generate(request, (text) => {
        if (id === generation.current) setOutput(text);
      });
      if (id === generation.current) {
        setStatus("ready");
        if (result.truncated)
          setNotice(
            "Output reached the model limit and may be incomplete. Try a shorter input.",
          );
      }
    } catch {
      if (id === generation.current) {
        writer.dispose();
        setStatus("idle");
        setError(
          "Generation failed. Your original text is preserved. Reload the model and try shorter text.",
        );
      }
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
