import { useDismissibleDetails } from "../../shared/hooks/useDismissibleDetails";
import { LoadingStatus } from "./LoadingStatus";
import { Button } from "../../shared/ui/Button";
import { useEffect, useRef, useState } from "react";
import { models, modelsBySize, supportsReasoning } from "./models";
import type { Writer } from "./inference";
import { Icon } from "../../shared/ui/Icon";
export function ModelPicker({
  writer,
  model,
  status,
  progress,
  contextUsage,
  required = false,
  supported,
  onSelect,
  onRemove,
  reasoning,
  reasoningAllowed,
  onReasoning,
}: {
  reasoning: boolean;
  reasoningAllowed: boolean;
  onReasoning: (value: boolean) => void;
  writer: Writer;
  model: string;
  status: string;
  progress?: { value: number; message: string };
  required?: boolean;
  supported: boolean | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  contextUsage: number;
}) {
  const picker = useRef<HTMLDetailsElement>(null);
  const [cache, setCache] = useState<Record<string, boolean | null>>({});
  const busy = [
    "loading",
    "writing",
    "stopping",
    "removing",
    "searching",
  ].includes(status);
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
    if (status === "ready" && picker.current?.open) {
      const restoreFocus = picker.current.contains(document.activeElement);
      picker.current.open = false;
      if (restoreFocus) picker.current.querySelector("summary")?.focus();
    }
    return () => {
      alive = false;
    };
  }, [writer, status, model]);
  useDismissibleDetails(picker);
  return (
    <details className="model-settings" ref={picker}>
      <summary
        aria-label="Models"
        title="Select, download or manage writing models"
      >
        <LoadingStatus
          progress={{ value: contextUsage, message: "" }}
          label="Conversation budget estimate"
          indeterminate={false}
        />
        <span className="model-name">
          {models.find((item) => item.id === model)?.label ?? model}
        </span>
        <Icon name="chevron" />
      </summary>
      <section className="model-panel" aria-label="Model setup">
        <div className="panel-heading">
          <h2>Models</h2>
          <Button
            className="secondary icon-button"
            aria-label="Close models"
            onClick={() => {
              if (picker.current) picker.current.open = false;
              picker.current?.querySelector("summary")?.focus();
            }}
          >
            <Icon name="close" />
          </Button>
        </div>
        {required && status !== "ready" && status !== "loading" && (
          <p role="alert" className="model-required">
            Load a model before sending. Your draft is kept.
          </p>
        )}
        {supported !== true && (
          <p className="muted">
            {supported === null
              ? "Checking device…"
              : "WebGPU unavailable on this device."}
          </p>
        )}
        <div
          role="radiogroup"
          aria-label="Writing model"
          className="model-catalog"
        >
          {modelsBySize.map((item) => (
            <div key={item.id} className="model-option">
              <label className="model-choice">
                <input
                  type="radio"
                  name="model"
                  checked={item.id === model}
                  disabled={busy || supported !== true}
                  onChange={() => {}}
                  onClick={() => onSelect(item.id)}
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
                        ? "Downloaded on this device"
                        : cache[item.id] === false
                          ? "Not downloaded"
                          : "Checking cache / unavailable"}
                  </small>
                </span>
              </label>
              <span className="model-row-action">
                {item.id === model && status === "loading" ? (
                  <LoadingStatus progress={progress} />
                ) : cache[item.id] === true ? (
                  <Button
                    className="secondary icon-button"
                    aria-label={`Delete ${item.label}`}
                    title={`Delete ${item.label}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete downloaded files for ${item.label}? You will need to download this model again. Your chats will be kept.`,
                        )
                      )
                        onRemove(item.id);
                    }}
                  >
                    <Icon name="clear" />
                  </Button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        {cache[model] === null && (
          <p role="status">
            Cannot check saved files. Browser storage may be unavailable.
          </p>
        )}
        {supportsReasoning(model) && (
          <label className="reasoning-setting">
            <input
              type="checkbox"
              checked={reasoning}
              disabled={busy || !reasoningAllowed}
              onChange={(event) => onReasoning(event.target.checked)}
            />
            <span>Reasoning</span>
            <small>Chat only · may take longer</small>
          </label>
        )}
      </section>
    </details>
  );
}
