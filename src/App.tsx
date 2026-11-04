import { useEffect, useRef, useState } from "react";
import {
  actions,
  primaryActions,
  extraActions,
  inputError,
  type Action,
} from "./actions";
import { LocalWriter, type Writer } from "./inference";
import { checkGPU, models } from "./models";
import { ChangeReview } from "./ChangeReview";
import { Icon } from "./Icon";
import { useWriter } from "./useWriter";
export default function App({
  writer: supplied,
  gpuCheck = checkGPU,
}: {
  writer?: Writer;
  gpuCheck?: () => Promise<boolean>;
}) {
  const [themeChoice, setThemeChoice] = useState<"light" | "dark" | null>(
    () => {
      try {
        const saved = localStorage.getItem("local-writer-theme");
        return saved === "light" || saved === "dark" ? saved : null;
      } catch {
        return null;
      } // Theme persistence is optional when storage is blocked.
    },
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  const theme = themeChoice ?? (systemDark ? "dark" : "light");
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setThemeChoice(next);
    try {
      localStorage.setItem("local-writer-theme", next);
    } catch {
      /* Keep the toggle working when storage is blocked. */
    }
  }
  const modelPicker = useRef<HTMLDetailsElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const [writer] = useState(() => supplied ?? new LocalWriter());
  const session = useWriter(writer);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>(models[0].id);
  const [hasCachedModel, setHasCachedModel] = useState<boolean | null>(null);
  const [modelCache, setModelCache] = useState<Record<string, boolean | null>>(
    {},
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        modelPicker.current?.open &&
        event.target instanceof Node &&
        !modelPicker.current.contains(event.target)
      ) {
        modelPicker.current.open = false;
        setSettingsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modelPicker.current?.open) {
        modelPicker.current.open = false;
        setSettingsOpen(false);
        modelPicker.current?.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const [cached, setCached] = useState<string>("Checking cache…");
  const [text, setText] = useState("");
  const [action, setAction] = useState<Action>("grammar");
  const [requestSource, setRequestSource] = useState("");
  const [resultAction, setResultAction] = useState<Action>("grammar");
  useEffect(() => {
    const failed = () =>
      setFeedback(
        "Offline app caching failed. You can still use the app online.",
      );
    window.addEventListener("offline-cache-failed", failed);
    return () => window.removeEventListener("offline-cache-failed", failed);
  }, []);
  const [feedback, setFeedback] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  const busy =
    session.status === "loading" ||
    session.status === "writing" ||
    session.status === "stopping" ||
    session.status === "removing";
  const selected = models.find((item) => item.id === model)!;
  useEffect(() => {
    let alive = true;
    gpuCheck().then(
      (value) => {
        if (alive) setSupported(value);
      },
      () => {
        if (alive) setSupported(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [gpuCheck]);
  useEffect(() => {
    let alive = true;
    setCached("Checking cache…");
    setHasCachedModel(null);
    Promise.all(
      models.map(async (item) => {
        try {
          return [item.id, await writer.cached(item.id)] as const;
        } catch {
          return [item.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      const cache = Object.fromEntries(entries);
      setModelCache(cache);
      const value = cache[model];
      setHasCachedModel(value);
      setCached(
        value === null
          ? "Cache unavailable. Check browser storage permissions."
          : value
            ? "Weights downloaded. Offline use also needs cached runtime files."
            : "First download needs internet.",
      );
    });
    return () => {
      alive = false;
    };
  }, [writer, model, session.status]);
  useEffect(() => {
    if (session.status === "ready") {
      setSettingsOpen(false);
    }
  }, [session.status]);
  function run() {
    const error = inputError(text);
    setFeedback(error ?? "");
    if (!error) {
      setRequestSource(text);
      setResultAction(action);
      void session.run({ text, action, terms: "", instruction: "" });
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(session.output);
      setFeedback("Copied.");
    } catch {
      setFeedback(
        "Clipboard access failed. Select the result and copy it manually.",
      );
    }
  }
  return (
    <main>
      <header>
        <h1>
          <a className="brand" href="./">
            Local Writer
          </a>
        </h1>
        <div className="header-tools">
          <button
            className="info-button secondary"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            className="info-button secondary"
            aria-label="About Local Writer"
            title="About Local Writer"
            onClick={() => infoDialog.current?.showModal()}
          >
            <Icon name="info" />
          </button>
        </div>
      </header>
      {supported === false && (
        <p role="alert">
          WebGPU is unavailable. Use a recent desktop browser with hardware
          acceleration, on HTTPS or localhost.
        </p>
      )}
      {supported === null && <p>Checking device support…</p>}
      {session.status === "loading" && (
        <div className="loading">
          <progress
            max={1}
            value={session.progress.value}
            aria-label="Model loading"
          />
          <p role="status">{session.progress.message}</p>
        </div>
      )}
      <section className="conversation" aria-label="Writing conversation">
        {!requestSource && (
          <p className="empty">What would you like to write?</p>
        )}
        {requestSource && (
          <article className="user-message">
            <strong>You</strong>
            <p>{requestSource}</p>
          </article>
        )}
        <div className="reply">
          <div className="editor-heading">
            <label htmlFor="result">Your result</label>
            <span>
              {session.status === "writing"
                ? "Writing…"
                : "Review before using"}
            </span>
          </div>
          <textarea
            id="result"
            rows={Math.max(
              3,
              Math.min(
                24,
                session.output.split("\n").length +
                  Math.ceil(session.output.length / 85),
              ),
            )}
            value={session.output}
            disabled={busy}
            onChange={(event) => session.setOutput(event.target.value)}
            placeholder="A clearer version will appear here."
          />
          <div className="editor-footer">
            <button
              className="secondary"
              disabled={busy || !session.output}
              title="Copy result to clipboard"
              onClick={copy}
            >
              <Icon name="copy" /> Copy result
            </button>
            <button
              className="secondary"
              disabled={busy || !session.output}
              title="Use this result as your next draft"
              onClick={() => {
                setPrevious(text);
                setText(session.output);
                session.setOutput("");
              }}
            >
              <Icon name="reuse" /> Use as input
            </button>
          </div>
        </div>
      </section>
      {session.output && !busy && resultAction === "grammar" && (
        <ChangeReview source={requestSource} result={session.output} />
      )}
      <section className="compose-area" aria-label="Message composer">
        <div className="actions" role="group" aria-label="Writing actions">
          {primaryActions.map((key) => (
            <button
              key={key}
              className="action"
              aria-pressed={key === action}
              title={actions[key].instruction}
              disabled={busy}
              onClick={() => setAction(key)}
            >
              <Icon name={key} />
              <span>{actions[key].label}</span>
            </button>
          ))}
          <label
            className={`more-actions ${extraActions.includes(action) ? "selected" : ""}`}
          >
            <Icon name={extraActions.includes(action) ? action : "more"} />
            <select
              aria-label="More writing actions"
              disabled={busy}
              title="More ways to rewrite your text"
              value={extraActions.includes(action) ? action : ""}
              onChange={(event) => {
                if (event.target.value) setAction(event.target.value as Action);
              }}
            >
              <option value="" disabled>
                More
              </option>
              {extraActions.map((key) => (
                <option key={key} value={key}>
                  {actions[key].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="composer">
          <label className="sr-only" htmlFor="source">
            Your text
          </label>
          <textarea
            id="source"
            value={text}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste or write something to improve…"
          />
          <div className="editor-footer">
            <button
              className="secondary"
              disabled={busy}
              aria-label="Clear"
              title="Clear writing and unload the model"
              onClick={() => {
                session.stop("");
                setText("");
                session.setOutput("");
                setRequestSource("");
                setPrevious(null);
                setFeedback("");
              }}
            >
              <Icon name="clear" />
            </button>
            {previous !== null && (
              <button
                className="secondary"
                aria-label="Undo input change"
                title="Restore your previous draft"
                disabled={busy}
                onClick={() => {
                  setText(previous);
                  setPrevious(null);
                }}
              >
                <Icon name="undo" />
              </button>
            )}
            <div className="run-bar">
              <details
                ref={modelPicker}
                className="model-settings"
                open={settingsOpen}
                onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
              >
                <summary
                  aria-label="Models"
                  title="Select, download or manage writing models"
                >
                  <Icon name="model" />
                  {selected.label.split(" · ")[1]}
                </summary>
                <section className="model-panel" aria-label="Model setup">
                  <div>
                    <h2 className="catalog-title">Writing models</h2>
                    <div
                      className="model-catalog"
                      role="radiogroup"
                      aria-label="Writing model"
                    >
                      {models.map((item) => (
                        <label className="model-option" key={item.id}>
                          <input
                            type="radio"
                            name="writing-model"
                            value={item.id}
                            checked={model === item.id}
                            disabled={busy}
                            onChange={() => {
                              session.stop("");
                              setModel(item.id);
                              setHasCachedModel(modelCache[item.id] ?? null);
                            }}
                          />
                          <span>
                            <strong>{item.label}</strong>
                            <small>
                              {item.download} · {item.memory}
                            </small>
                            <small>
                              {model === item.id && session.status === "ready"
                                ? "In use"
                                : modelCache[item.id] === true
                                  ? "Downloaded"
                                  : modelCache[item.id] === false
                                    ? "Not downloaded"
                                    : "Cache status unavailable"}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="muted">{cached}</p>
                  </div>
                  <div className="model-controls">
                    <button
                      disabled={
                        !supported || busy || session.status === "ready"
                      }
                      title="Load the selected model on this device"
                      onClick={() => void session.load(model)}
                    >
                      <Icon
                        name={
                          session.status === "ready" ? "grammar" : "download"
                        }
                      />
                      {session.status === "ready"
                        ? "Model ready"
                        : hasCachedModel === true
                          ? "Load selected model"
                          : "Download / load model"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || hasCachedModel !== true}
                      title="Remove the selected model's downloaded files"
                      onClick={() => void session.remove(model)}
                    >
                      <Icon name="clear" /> Remove model cache
                    </button>
                  </div>
                </section>
              </details>
              {busy ? (
                <button
                  className="send-button"
                  aria-label={
                    session.status === "removing" ? "Removing cache…" : "Stop"
                  }
                  title="Stop"
                  disabled={session.status === "removing"}
                  onClick={() => session.stop()}
                >
                  <Icon name="stop" />
                </button>
              ) : (
                <button
                  disabled={
                    session.status !== "ready" || Boolean(inputError(text))
                  }
                  className="send-button"
                  aria-label={`${actions[action].label} →`}
                  title={
                    session.status === "ready"
                      ? actions[action].label
                      : "Open the model picker to load a model"
                  }
                  onClick={run}
                >
                  <Icon name="send" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      {inputError(text) && text.length > 0 && (
        <p role="alert">{inputError(text)}</p>
      )}
      {(session.error || feedback) && (
        <p role="status">{session.error || feedback}</p>
      )}
      {session.notice && <p role="status">{session.notice}</p>}
      <dialog
        ref={infoDialog}
        className="info-dialog"
        aria-labelledby="info-title"
      >
        <h2 id="info-title">About Local Writer</h2>
        <p>
          Your writing stays on this device. No account or saved writing
          history.
        </p>
        <p>Model downloads connect to Hugging Face and the runtime host.</p>
        <form method="dialog">
          <button title="Close information">
            <Icon name="close" /> Close
          </button>
        </form>
      </dialog>
    </main>
  );
}
