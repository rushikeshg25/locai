import { Button } from "./Button";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  provider,
  onProvider,
  serverLabel,
  serverPanel,
  autoLoad,
  onAutoLoad,
}: {
  provider: "browser" | "server";
  onProvider: (value: "browser" | "server") => void;
  serverLabel: string;
  serverPanel: ReactNode;
  autoLoad: boolean;
  onAutoLoad: (value: boolean) => void;
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
    if (provider === "browser")
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
  }, [writer, status, model, provider]);
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
        <span className="model-name">
          {provider === "server"
            ? serverLabel || "Local server"
            : (models
                .find((item) => item.id === model)
                ?.label.split(" · ")[1] ?? model)}
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <section className="model-panel" aria-label="Model setup">
        <h2>Models</h2>
        <div className="mode-switch" role="group" aria-label="Model provider">
          <Button
            className="secondary"
            aria-pressed={provider === "browser"}
            disabled={busy}
            onClick={() => onProvider("browser")}
          >
            In browser
          </Button>
          <Button
            className="secondary"
            aria-pressed={provider === "server"}
            disabled={busy}
            onClick={() => onProvider("server")}
          >
            Local server
          </Button>
        </div>
        {provider === "server" ? (
          serverPanel
        ) : (
          <>
            <p className="muted">
              {supported === true
                ? "WebGPU available"
                : "WebGPU unavailable or checking"}{" "}
              · Small models can make mistakes on complex requests.
            </p>
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
              <Button
                disabled={!supported || busy || status === "ready"}
                onClick={onLoad}
              >
                <Icon name="download" />
                {status === "ready"
                  ? "Model ready"
                  : cache[model]
                    ? "Load selected model"
                    : "Download / load model"}
              </Button>
              <Button
                className="secondary"
                disabled={busy || status !== "ready"}
                onClick={onUnload}
              >
                Unload
              </Button>
              <Button
                className="secondary"
                disabled={busy || cache[model] !== true}
                onClick={onRemove}
              >
                <Icon name="clear" />
                Remove model cache
              </Button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={autoLoad}
                disabled={busy}
                onChange={(event) => onAutoLoad(event.target.checked)}
              />{" "}
              Automatically load downloaded weights on startup
            </label>
            <p className="muted">
              Loading may still need internet for missing runtime files.
            </p>
            <StorageInfo refresh={status} />
          </>
        )}
      </section>
    </details>
  );
}

function StorageInfo({ refresh }: { refresh: string }) {
  const [info, setInfo] = useState(""),
    [retention, setRetention] = useState("");
  useEffect(() => {
    let alive = true;
    navigator.storage?.estimate().then(
      (value) => {
        if (alive)
          setInfo(
            `${Math.round((value.usage ?? 0) / 1e6)} MB used of about ${Math.round((value.quota ?? 0) / 1e6)} MB available to this site.`,
          );
      },
      () => {
        if (alive) setInfo("Storage estimate unavailable.");
      },
    );
    return () => {
      alive = false;
    };
  }, [refresh]);
  return (
    <>
      <p className="muted">
        {info || "Browser storage estimates unavailable."}
      </p>
      <Button
        className="secondary"
        onClick={async () => {
          try {
            const kept = await navigator.storage?.persist();
            setRetention(
              kept
                ? "Persistent storage granted. You can still delete data manually."
                : "Persistent storage was not granted. The browser may evict cached files.",
            );
          } catch {
            setRetention("Persistent storage is unavailable.");
          }
        }}
      >
        Keep downloads on device
      </Button>
      {retention && (
        <p role="status" className="muted">
          {retention}
        </p>
      )}
    </>
  );
}
