import { Button } from "./Button";
import { useEffect, useRef, useState } from "react";
import { listServerModels, type ServerConfig } from "./server";
export function ServerSettings({
  config,
  busy,
  ready,
  onConnect,
  onDisconnect,
}: {
  config: ServerConfig;
  busy: boolean;
  ready: boolean;
  onConnect: (config: ServerConfig) => void;
  onDisconnect: () => void;
}) {
  const [url, setURL] = useState(config.baseURL),
    [model, setModel] = useState(config.model),
    [context, setContext] = useState(config.contextWindow);
  const [models, setModels] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  return (
    <div>
      <p className="muted">
        Connect Ollama or llama.cpp on this computer. Messages and attachments
        go to that server. Install models using its own tools.
      </p>
      <label>
        Server URL
        <input
          type="url"
          value={url}
          disabled={busy || loading || ready}
          onChange={(event) => {
            setURL(event.target.value);
            setModels([]);
            setModel("");
          }}
        />
      </label>
      <Button
        className="secondary"
        disabled={busy || loading || ready}
        onClick={async () => {
          setLoading(true);
          setError("");
          const controller = new AbortController();
          request.current = controller;
          try {
            const items = await listServerModels(
              url,
              AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
            );
            if (controller.signal.aborted) return;
            setModels(items);
            setModel(items.includes(model) ? model : (items[0] ?? ""));
            if (!items.length)
              setError(
                "No installed models found. Install one on the server first.",
              );
          } catch (cause) {
            if (!controller.signal.aborted)
              setError(
                `${(cause as Error).message} Ensure the server is running and allows this app’s origin.`,
              );
          } finally {
            if (!controller.signal.aborted) setLoading(false);
          }
        }}
      >
        {loading ? "Checking…" : "Find installed models"}
      </Button>
      <label>
        Server model
        <select
          aria-label="Server model"
          value={model}
          disabled={busy || ready}
          onChange={(event) => setModel(event.target.value)}
        >
          <option value="" disabled>
            Select a model
          </option>
          {Array.from(
            new Set([...models, ...(config.model ? [config.model] : [])]),
          ).map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
      </label>
      <label>
        Configured context window
        <input
          type="number"
          min={2048}
          max={131072}
          step={1}
          value={context}
          disabled={busy || ready}
          onChange={(event) => setContext(Number(event.target.value))}
        />
      </label>
      <p className="muted">
        Match your server’s actual context setting. This field only limits
        outgoing history; it does not reconfigure the server.
      </p>
      <Button
        disabled={
          busy ||
          ready ||
          !model ||
          !Number.isInteger(context) ||
          context < 2048 ||
          context > 131072
        }
        onClick={() => {
          try {
            onConnect({ baseURL: url, model, contextWindow: context });
            setError("");
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      >
        {ready ? "Server connected" : "Connect server"}
      </Button>
      {ready && (
        <Button className="secondary" disabled={busy} onClick={onDisconnect}>
          Disconnect
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
