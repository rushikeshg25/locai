import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useTheme } from "./useTheme";
import { ModelPicker } from "./ModelPicker";
import { Markdown } from "./Markdown";
import {
  newConversation,
  conversationHistory,
  messageText,
  type Message,
  type Conversation,
  type Attachment,
} from "./conversations";
import {
  readSaved,
  saveChat,
  forgetChat,
  exportMarkdown,
  readAttachments,
} from "./storage";
import { prepareMessages } from "./prompts";
export default function App({
  writer: supplied,
  gpuCheck = checkGPU,
}: {
  writer?: Writer;
  gpuCheck?: () => Promise<boolean>;
}) {
  const { theme, toggleTheme } = useTheme();
  const [writer] = useState(() => supplied ?? new LocalWriter());
  const session = useWriter(writer);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>(models[0].id);
  const [saved] = useState(readSaved);
  const [chats, setChats] = useState<Conversation[]>(() => [
    newConversation(),
    ...saved.chats,
  ]);
  const [active, setActive] = useState("");
  const chat = chats.find((item) => item.id === active) ?? chats[0];
  const [text, setText] = useState("");
  const [action, setAction] = useState<Action>("grammar");
  const [feedback, setFeedback] = useState(saved.warning);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selection, setSelection] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const persistFailures = useRef(new Set<string>());
  useEffect(() => {
    for (const item of chats) {
      if (
        !item.saved ||
        item.messages.some((message) => message.state === "streaming")
      )
        continue;
      try {
        saveChat(item);
        persistFailures.current.delete(item.id);
      } catch {
        if (!persistFailures.current.has(item.id)) {
          setFeedback(
            "Could not update the saved conversation. Export it to keep your latest changes.",
          );
          persistFailures.current.add(item.id);
        }
      }
    }
  }, [chats]);
  const [edit, setEdit] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [resend, setResend] = useState<Message[] | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [latest, setLatest] = useState(false);
  const info = useRef<HTMLDialogElement>(null);
  const busy = ["loading", "writing", "stopping", "removing"].includes(
    session.status,
  );
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
    const failed = () =>
      setFeedback(
        "Offline app caching failed. You can still use the app online.",
      );
    window.addEventListener("offline-cache-failed", failed);
    return () => window.removeEventListener("offline-cache-failed", failed);
  }, []);
  useLayoutEffect(() => {
    if (composer.current) {
      composer.current.style.height = "auto";
      composer.current.style.height = `${Math.min(composer.current.scrollHeight, 240)}px`;
    }
  }, [text]);
  useLayoutEffect(() => {
    if (nearBottom.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
    else setLatest(true);
  }, [chat.messages]);
  function update(id: string, fn: (item: Conversation) => Conversation) {
    setChats((items) =>
      items.map((item) =>
        item.id === id ? { ...fn(item), updatedAt: Date.now() } : item,
      ),
    );
  }
  function patch(id: string, messageId: string, values: Partial<Message>) {
    update(id, (item) => ({
      ...item,
      messages: item.messages.map((message) =>
        message.id === messageId ? { ...message, ...values } : message,
      ),
    }));
  }
  function newChat() {
    const next = newConversation(chat.mode);
    setChats((items) => [next, ...items]);
    setActive(next.id);
    setText("");
    setAttachments([]);
    setSelection("");
    setResend(null);
    setFeedback("");
    setEdit(null);
    nearBottom.current = true;
    setLatest(false);
  }
  async function send(
    source = text,
    prefix = resend ?? chat.messages,
    fork = resend !== null,
    attached = attachments,
    requestMode = chat.mode,
    requestAction = action,
  ) {
    if (busy || session.status !== "ready") return;
    const error = inputError(source);
    if (error) {
      setFeedback(error);
      return;
    }
    const request = {
      text: messageText({ content: source, attachments: attached }),
      mode: requestMode,
      action: requestAction,
      terms: "",
      instruction: "",
      history: conversationHistory(prefix),
    };
    let budget;
    try {
      budget = prepareMessages(request);
    } catch (cause) {
      setFeedback((cause as Error).message);
      return;
    }
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: source,
      attachments: attached,
      mode: requestMode,
      action: requestAction,
    };
    const answer: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      state: "streaming",
      model,
      modelLabel: selected.label,
      mode: requestMode,
      action: requestAction,
      source,
      omitted: budget.omitted,
    };
    let id = chat.id;
    if (fork) {
      const branch = {
        ...newConversation(requestMode),
        title: `${source.slice(0, 36)} (branch)`,
        messages: [...prefix, user, answer],
      };
      id = branch.id;
      setChats((items) => [branch, ...items]);
      setActive(id);
    } else
      update(id, (item) => ({
        ...item,
        title: item.messages.length ? item.title : source.slice(0, 44),
        messages: [...prefix, user, answer],
      }));
    setText("");
    setAttachments([]);
    setSelection("");
    setResend(null);
    setFeedback("");
    nearBottom.current = true;
    setLatest(false);
    const result = await session.run(request, (content) =>
      patch(id, answer.id, { content }),
    );
    patch(id, answer.id, {
      content: result.text,
      state: result.state,
      truncated: result.truncated,
    });
  }
  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setFeedback("Copied.");
    } catch {
      setFeedback("Copy failed. Select the text and copy it manually.");
    }
  }
  return (
    <main className="workspace">
      <header>
        <h1>Local Writer</h1>
        <div className="header-tools">
          <button
            className="secondary"
            disabled={busy}
            onClick={newChat}
            title="Start an empty conversation; keep the model loaded"
          >
            <Icon name="clear" />
            New chat
          </button>
          <button
            className="icon-button secondary"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            className="icon-button secondary"
            aria-label="About Local Writer"
            title="About Local Writer"
            onClick={() => info.current?.showModal()}
          >
            <Icon name="info" />
          </button>
        </div>
      </header>
      <div className="chat-controls">
        <small>{chat.saved ? "Saved on this device" : "Temporary chat"}</small>
        <button
          className="secondary"
          disabled={busy || !chat.messages.length}
          onClick={() => {
            try {
              if (chat.saved) {
                forgetChat(chat.id);
                update(chat.id, (item) => ({ ...item, saved: false }));
                setFeedback(
                  "Removed from device storage. This tab still has the conversation.",
                );
              } else {
                saveChat(chat);
                update(chat.id, (item) => ({ ...item, saved: true }));
                setFeedback(
                  "Saved on this device. Future changes to this chat will also be saved.",
                );
              }
            } catch {
              setFeedback(
                "Could not change browser storage. Export the conversation to keep a copy.",
              );
            }
          }}
        >
          {chat.saved ? "Make temporary" : "Save on device"}
        </button>
        <button
          className="secondary"
          disabled={!chat.messages.length}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([exportMarkdown(chat)], {
                type: "text/markdown;charset=utf-8",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "local-writer-chat.md";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export
        </button>
        <button
          className="secondary"
          disabled={busy}
          title="Delete this conversation and its saved copy"
          onClick={() => {
            if (!window.confirm("Delete this conversation and its saved copy?"))
              return;
            try {
              forgetChat(chat.id);
              setChats((items) => {
                const remaining = items.filter((item) => item.id !== chat.id);
                return remaining.length ? remaining : [newConversation()];
              });
              setActive("");
              setText("");
              setAttachments([]);
              setResend(null);
            } catch {
              setFeedback(
                "Could not delete the saved copy. Browser storage may be blocked.",
              );
            }
          }}
        >
          Delete
        </button>
      </div>
      {chats.length > 1 && (
        <label className="conversation-switch">
          Conversation{" "}
          <select
            aria-label="Conversation"
            value={chat.id}
            disabled={busy}
            onChange={(event) => {
              setActive(event.target.value);
              setText("");
              setAttachments([]);
              setSelection("");
              setResend(null);
              setEdit(null);
              nearBottom.current = true;
              setLatest(false);
            }}
          >
            {chats.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {supported === false && (
        <p role="alert" className="banner">
          WebGPU is unavailable. Use a recent desktop browser with hardware
          acceleration, on HTTPS or localhost.
        </p>
      )}
      <div
        className="transcript"
        ref={scroll}
        onMouseUp={() => {
          const selected = window.getSelection();
          setSelection(
            selected &&
              scroll.current?.contains(selected.anchorNode) &&
              scroll.current?.contains(selected.focusNode)
              ? selected.toString()
              : "",
          );
        }}
        onScroll={() => {
          const el = scroll.current!;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          if (nearBottom.current) setLatest(false);
        }}
      >
        <section aria-label="Conversation messages" className="conversation">
          {!chat.messages.length && (
            <div className="empty">
              <h2>What’s on your mind?</h2>
              <p>Chat about an idea, or switch to Write to polish a draft.</p>
            </div>
          )}
          {chat.messages.map((message, index) => (
            <article
              className={`message ${message.role}`}
              key={message.id}
              aria-label={`${message.role === "user" ? "You" : "Assistant"} message`}
            >
              <div className="message-heading">
                <strong>
                  {message.role === "user"
                    ? "You"
                    : (message.modelLabel ?? "Assistant")}
                </strong>
                {message.mode === "write" && (
                  <small>{actions[message.action ?? "grammar"].label}</small>
                )}
              </div>
              {edit === message.id ? (
                <div className="result-editor">
                  <textarea
                    aria-label="Edit result"
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                  />
                  <button
                    onClick={() => {
                      patch(chat.id, message.id, { content: editText });
                      setEdit(null);
                    }}
                  >
                    Save edit
                  </button>
                  <button className="secondary" onClick={() => setEdit(null)}>
                    Cancel
                  </button>
                </div>
              ) : message.role === "user" ? (
                <p className="user-text">{message.content}</p>
              ) : (
                <Markdown text={message.content} />
              )}
              {message.attachments?.map((file, index) => (
                <details className="attachment-preview" key={index}>
                  <summary>{file.name}</summary>
                  <pre>{file.content}</pre>
                </details>
              ))}
              {message.state === "streaming" && (
                <small role="status">
                  {message.content ? "Responding…" : "Thinking…"}
                </small>
              )}
              {message.state === "stopped" && (
                <small>Stopped · incomplete response</small>
              )}
              {message.state === "error" && (
                <small>Response failed · your message is preserved</small>
              )}
              {message.truncated && (
                <p className="muted">Response reached the output limit.</p>
              )}
              {!!message.omitted && (
                <p className="muted">
                  {message.omitted} older messages were left out of this request
                  to fit the model.
                </p>
              )}
              <div className="message-tools">
                {message.content && (
                  <button
                    className="secondary"
                    title="Copy message"
                    onClick={() => void copy(message.content)}
                  >
                    <Icon name="copy" />
                    Copy
                  </button>
                )}
                {message.role === "user" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    title="Edit and resend in a new branch"
                    onClick={() => {
                      setText(message.content);
                      setAttachments(message.attachments ?? []);
                      update(chat.id, (item) => ({
                        ...item,
                        mode: message.mode ?? "chat",
                      }));
                      setAction(message.action ?? "grammar");
                      setResend(chat.messages.slice(0, index));
                      composer.current?.focus();
                    }}
                  >
                    <Icon name="reuse" />
                    Edit & resend
                  </button>
                )}
                {message.role === "assistant" && (
                  <>
                    <button
                      className="secondary"
                      disabled={busy || session.status !== "ready"}
                      title="Retry this request in a new branch"
                      onClick={() => {
                        const user = chat.messages[index - 1];
                        if (user)
                          void send(
                            user.content,
                            chat.messages.slice(0, index - 1),
                            true,
                            user.attachments ?? [],
                            user.mode ?? "chat",
                            user.action ?? "grammar",
                          );
                      }}
                    >
                      <Icon name="undo" />
                      Retry
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !message.content}
                      title="Edit this response"
                      onClick={() => {
                        setEdit(message.id);
                        setEditText(message.content);
                      }}
                    >
                      Edit result
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !message.content}
                      title="Use response as a new draft"
                      onClick={() => {
                        setText(message.content);
                        composer.current?.focus();
                      }}
                    >
                      <Icon name="reuse" />
                      Use as input
                    </button>
                  </>
                )}
              </div>
              {message.mode === "write" &&
                message.role === "assistant" &&
                message.content &&
                message.state !== "streaming" && (
                  <ChangeReview
                    source={message.source ?? ""}
                    result={message.content}
                  />
                )}
            </article>
          ))}
        </section>
      </div>
      {latest && (
        <button
          className="jump secondary"
          onClick={() => {
            nearBottom.current = true;
            setLatest(false);
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
          }}
        >
          ↓ Jump to latest
        </button>
      )}
      <section className="compose-area" aria-label="Message composer">
        {selection.trim() && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setText(selection);
              setAttachments([]);
              setSelection("");
              setResend(null);
              update(chat.id, (item) => ({ ...item, mode: "write" }));
              composer.current?.focus();
            }}
          >
            Rewrite selected text
          </button>
        )}
        <div className="compose-options">
          <div className="mode-switch" role="group" aria-label="Mode">
            {(["chat", "write"] as const).map((mode) => (
              <button
                key={mode}
                className="secondary"
                aria-pressed={chat.mode === mode}
                disabled={busy}
                onClick={() => update(chat.id, (item) => ({ ...item, mode }))}
              >
                {mode === "chat" ? "Chat" : "Write"}
              </button>
            ))}
          </div>
          {chat.mode === "write" && (
            <div className="actions" role="group" aria-label="Writing actions">
              {primaryActions.map((key) => (
                <button
                  key={key}
                  className="secondary"
                  aria-pressed={key === action}
                  title={actions[key].instruction}
                  disabled={busy}
                  onClick={() => setAction(key)}
                >
                  <Icon name={key} />
                  {actions[key].label}
                </button>
              ))}
              <select
                aria-label="More writing actions"
                disabled={busy}
                value={extraActions.includes(action) ? action : ""}
                onChange={(event) => setAction(event.target.value as Action)}
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
            </div>
          )}
        </div>
        {resend !== null && (
          <div className="draft-note">
            Editing a previous request · original conversation will be kept.
            <button className="secondary" onClick={() => setResend(null)}>
              Cancel edit
            </button>
          </div>
        )}
        <div className="composer">
          <label className="sr-only" htmlFor="source">
            Your text
          </label>
          <textarea
            ref={composer}
            id="source"
            rows={2}
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value);
              setSelection("");
            }}
            onSelect={(event) => {
              const el = event.currentTarget;
              setSelection(el.value.slice(el.selectionStart, el.selectionEnd));
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={
              chat.mode === "chat" ? "Message…" : "Paste or write a draft…"
            }
          />
          {attachments.length > 0 && (
            <div className="attachments">
              {attachments.map((file, index) => (
                <span key={index}>
                  {file.name}
                  <button
                    className="secondary"
                    aria-label={`Remove ${file.name}`}
                    disabled={busy}
                    onClick={() =>
                      setAttachments((items) =>
                        items.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="composer-footer">
            <input
              ref={files}
              className="sr-only"
              aria-label="Attach text files"
              type="file"
              accept=".txt,.md,.markdown"
              multiple
              disabled={busy}
              onChange={async (event) => {
                const selected = Array.from(event.target.files ?? []);
                event.target.value = "";
                try {
                  setAttachments(await readAttachments(selected));
                  setFeedback("");
                } catch (cause) {
                  setFeedback((cause as Error).message);
                }
              }}
            />
            <button
              className="secondary icon-button"
              aria-label="Attach text files"
              title="Attach up to 3 UTF-8 text or Markdown files, 24 KB total"
              disabled={busy}
              onClick={() => files.current?.click()}
            >
              <Icon name="attach" />
            </button>
            <span className="muted keyboard-hint">
              Shift + Enter for a new line
            </span>
            <div className="run-bar">
              <ModelPicker
                writer={writer}
                model={model}
                status={session.status}
                supported={supported}
                onSelect={(id) => {
                  session.stop("");
                  setModel(id);
                }}
                onLoad={() => void session.load(model)}
                onRemove={() => void session.remove(model)}
                onUnload={() => session.stop("")}
              />
              {busy ? (
                <button
                  className="send-button"
                  aria-label="Stop"
                  title="Stop"
                  disabled={
                    session.status === "removing" ||
                    session.status === "stopping"
                  }
                  onClick={() => session.stop()}
                >
                  <Icon name="stop" />
                </button>
              ) : (
                <button
                  className="send-button"
                  aria-label="Send message"
                  title={
                    session.status === "ready"
                      ? "Send message"
                      : "Open Models to load a model"
                  }
                  disabled={session.status !== "ready" || !!inputError(text)}
                  onClick={() => void send()}
                >
                  <Icon name="send" />
                </button>
              )}
            </div>
          </div>
        </div>
        {session.status === "loading" && (
          <div className="loading">
            <progress
              max={1}
              value={session.progress.value || undefined}
              aria-label="Model loading"
            />
            <p role="status">{session.progress.message}</p>
          </div>
        )}
        {(session.error || feedback || session.notice) && (
          <p role="status" className="feedback">
            {session.error || feedback || session.notice}
          </p>
        )}
        {text && inputError(text) && <p role="alert">{inputError(text)}</p>}
      </section>
      <dialog
        ref={info}
        className="info-dialog"
        aria-labelledby="info-title"
        onClick={(event) => {
          if (event.target === info.current) info.current?.close();
        }}
      >
        <h2 id="info-title">About Local Writer</h2>
        <p>
          Browser models run on this device. Chats are temporary unless you
          choose Save on device. Saved chats and attachments remain in this
          browser until deleted.
        </p>
        <p>
          Model downloads contact Hugging Face and the runtime host. Review AI
          answers before using them.
        </p>
        <form method="dialog">
          <button>
            <Icon name="close" />
            Close
          </button>
        </form>
      </dialog>
    </main>
  );
}
