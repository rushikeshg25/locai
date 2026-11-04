import { useEffect, useRef, useState } from "react";
import { models } from "./models";
import type { Writer } from "./inference";
import { Icon } from "./Icon";
export function ModelPicker({
  writer,
  model,
  status,
  supported,
  onSelect,
  onLoad,
  onRemove,
  onUnload,
}: {
  writer: Writer;
  model: string;
  status: string;
  supported: boolean | null;
  onSelect: (id: string) => void;
  onLoad: () => void;
  onRemove: () => void;
  onUnload: () => void;
}) {
  const picker = useRef<HTMLDetailsElement>(null);
  const [cache, setCache] = useState<Record<string, boolean | null>>({});
  const busy = ["loading", "writing", "stopping", "removing"].includes(status);
  useEffect(() => {
    let alive = true;
    Promise.all(
      models.map(async (item) => {
        try {
          return [item.id, await writer.cached(item.id)] as const;
        } catch {
          return [item.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (alive) setCache(Object.fromEntries(entries));
    });
    if (status === "ready" && picker.current) picker.current.open = false;
    return () => {
      alive = false;
    };
  }, [writer, status, model]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !picker.current?.contains(event.target) &&
        picker.current
      )
        picker.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && picker.current?.open) {
        picker.current.open = false;
        picker.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details className="model-settings" ref={picker}>
      <summary
        aria-label="Models"
        title="Select, download or manage writing models"
      >
        <Icon name="model" />
        {models.find((item) => item.id === model)?.label.split(" · ")[1] ??
          model}
        <span aria-hidden="true">⌄</span>
      </summary>
      <section className="model-panel" aria-label="Model setup">
        <h2>Writing models</h2>
        <div
          role="radiogroup"
          aria-label="Writing model"
          className="model-catalog"
        >
          {models.map((item) => (
            <label key={item.id} className="model-option">
              <input
                type="radio"
                name="model"
                checked={item.id === model}
                disabled={busy}
                onChange={() => onSelect(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>
                  {item.download} · {item.memory}
                </small>
                <small>
                  {item.id === model && status === "ready"
                    ? "Loaded in memory"
                    : cache[item.id] === true
                      ? "Weights downloaded"
                      : cache[item.id] === false
                        ? "Not downloaded"
                        : "Checking cache / unavailable"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <p className="muted">
          Offline use requires weights, tokenizer, config and runtime files.
        </p>
        <div className="model-controls">
          <button
            disabled={!supported || busy || status === "ready"}
            onClick={onLoad}
          >
            <Icon name="download" />
            {status === "ready"
              ? "Model ready"
              : cache[model]
                ? "Load selected model"
                : "Download / load model"}
          </button>
          <button
            className="secondary"
            disabled={busy || status !== "ready"}
            onClick={onUnload}
          >
            Unload
          </button>
          <button
            className="secondary"
            disabled={busy || cache[model] !== true}
            onClick={onRemove}
          >
            <Icon name="clear" />
            Remove model cache
          </button>
        </div>
      </section>
    </details>
  );
}
