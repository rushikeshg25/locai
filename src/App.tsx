import { ConversationSidebar } from "./ConversationSidebar";
import { BrowserWelcome } from "./BrowserWelcome";
import { Button } from "./Button";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
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
import { LoadingStatus } from "./LoadingStatus";
import { getPreference, setPreference, preferredModel } from "./preferences";
import { prepareMessages, missingTerms } from "./prompts";
export default function App({
  writer: supplied,
  gpuCheck = checkGPU,
}: {
  writer?: Writer;
  gpuCheck?: () => Promise<boolean>;
}) {
  const { theme, toggleTheme } = useTheme();
  const [browserWriter] = useState(() => supplied ?? new LocalWriter());
  const writer = browserWriter;
  const [autoLoad, setAutoLoad] = useState(
    () => getPreference("auto-load", "false") === "true",
  );
  const autoAttempted = useRef(false);
  const session = useWriter(writer);
  const currentStatus = useRef(session.status);
  currentStatus.current = session.status;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>(preferredModel);
  const [saved] = useState(readSaved);
  const [chats, setChats] = useState<Conversation[]>(() => [
    newConversation(),
    ...saved.chats,
  ]);
  const [active, setActive] = useState("");
  const chat = chats.find((item) => item.id === active) ?? chats[0];
  const [text, setText] = useState("");
  const [terms, setTerms] = useState("");
  const [instruction, setInstruction] = useState("");
  const [action, setAction] = useState<Action>("grammar");
  const [feedback, setFeedback] = useState(saved.warning);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentRequest = useRef(0);
  function replaceAttachments(value: SetStateAction<Attachment[]>) {
    attachmentRequest.current++;
    setAttachments(value);
  }
  useEffect(
    () => () => {
      attachmentRequest.current++;
    },
    [],
  );
  const [selection, setSelection] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const persistFailures = useRef(new Set<string>());
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("local-writer-chat-v1:")) {
        setChats((items) =>
          items.map((item) =>
            item.saved &&
            (event.key === null ||
              event.key === `local-writer-chat-v1:${item.id}`)
              ? { ...item, saved: false }
              : item,
          ),
        );
        setFeedback(
          "Saved chats changed in another tab. This tab’s copies are now temporary; save again to keep your changes.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
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
    if (autoAttempted.current || supported !== true || !autoLoad) return;
    let alive = true;
    browserWriter.cached(model).then(
      (cached) => {
        if (alive) {
          autoAttempted.current = true;
          if (cached && currentStatus.current === "idle")
            void session.load(model);
        }
      },
      () =>
        setFeedback("Could not check the model cache. Load it from Models."),
    );
    return () => {
      alive = false;
    };
  }, [supported, autoLoad, model, browserWriter]);
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
    replaceAttachments([]);
    setSelection("");
    setResend(null);
    setFeedback("");
    setEdit(null);
    nearBottom.current = true;
    setLatest(false);
  }
  function selectChat(id: string) {
    setActive(id);
    setText("");
    replaceAttachments([]);
    setSelection("");
    setResend(null);
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
    requestTerms = terms,
    requestInstruction = instruction,
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
      terms: requestTerms,
      instruction: requestInstruction,
      history: conversationHistory(prefix),
      contextWindow: 4096,
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
      terms: requestTerms,
      instruction: requestInstruction,
    };
    const answer: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      state: "streaming",
      model: selected.id,
      modelLabel: selected.label,
      mode: requestMode,
      action: requestAction,
      source,
      terms: requestTerms,
      instruction: requestInstruction,
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
    replaceAttachments([]);
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
  let contextLabel = "";
  if (text.trim()) {
    try {
      const budget = prepareMessages({
        text: messageText({ content: text, attachments }),
        mode: chat.mode,
        action,
        terms,
        instruction,
        history: conversationHistory(resend ?? chat.messages),
        contextWindow: 4096,
      });
      contextLabel = `Context estimate: ${budget.used} / ${budget.budget} byte units${budget.omitted ? ` · ${budget.omitted} older messages excluded` : ""}`;
    } catch (cause) {
      contextLabel = (cause as Error).message;
    }
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
    <div className="app-shell">
      <ConversationSidebar
        chats={chats}
        active={chat.id}
        busy={busy}
        onSelect={selectChat}
      />
      <main className="workspace">
        <header>
          <h1>Local Writer</h1>
          <div className="header-tools">
            <Button
              className="secondary"
              disabled={busy}
              onClick={newChat}
              title="Start an empty conversation; keep the model loaded"
            >
              <Icon name="plus" />
              New chat
            </Button>
            <Button
              className="icon-button secondary"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={toggleTheme}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </Button>
            <Button
              className="icon-button secondary"
              aria-label="About Local Writer"
              title="About Local Writer"
              onClick={() => info.current?.showModal()}
            >
              <Icon name="info" />
            </Button>
          </div>
        </header>
        <div className="chat-controls">
          <small>
            {chat.saved ? "Saved on this device" : "Temporary chat"}
          </small>
          <Button
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
            <Icon name="save" />
            {chat.saved ? "Make temporary" : "Save on device"}
          </Button>
          <Button
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
            <Icon name="download" />
            Export
          </Button>
          <Button
            className="secondary"
            disabled={busy}
            title="Delete this conversation and its saved copy"
            onClick={() => {
              if (
                !window.confirm("Delete this conversation and its saved copy?")
              )
                return;
              try {
                forgetChat(chat.id);
                setChats((items) => {
                  const remaining = items.filter((item) => item.id !== chat.id);
                  return remaining.length ? remaining : [newConversation()];
                });
                setActive("");
                setText("");
                replaceAttachments([]);
                setResend(null);
              } catch {
                setFeedback(
                  "Could not delete the saved copy. Browser storage may be blocked.",
                );
              }
            }}
          >
            <Icon name="clear" />
            Delete
          </Button>
        </div>
        {chats.length > 1 && (
          <label className="conversation-switch">
            Conversation{" "}
            <select
              aria-label="Conversation"
              value={chat.id}
              disabled={busy}
              onChange={(event) => selectChat(event.target.value)}
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
              <BrowserWelcome
                ready={session.status === "ready"}
                supported={supported}
                model={selected.label}
                onPrompt={(prompt) => {
                  setText(prompt);
                  composer.current?.focus();
                }}
              />
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
                    <Button
                      onClick={() => {
                        patch(chat.id, message.id, { content: editText });
                        setEdit(null);
                      }}
                    >
                      Save edit
                    </Button>
                    <Button className="secondary" onClick={() => setEdit(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : message.role === "user" ? (
                  <p className="user-text">{message.content}</p>
                ) : (
                  message.content && <Markdown text={message.content} />
                )}
                {message.attachments?.map((file, index) => (
                  <details className="attachment-preview" key={index}>
                    <summary>{file.name}</summary>
                    <pre>{file.content}</pre>
                  </details>
                ))}
                {message.state === "streaming" && (
                  <div
                    className="reply-progress"
                    role="status"
                    aria-atomic="true"
                  >
                    <span className="reply-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span>{message.content ? "Responding…" : "Thinking…"}</span>
                  </div>
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
                    {message.omitted} older messages were left out of this
                    request to fit the model.
                  </p>
                )}
                <div className="message-tools">
                  {message.content && (
                    <Button
                      className="secondary"
                      title="Copy message"
                      onClick={() => void copy(message.content)}
                    >
                      <Icon name="copy" />
                      Copy
                    </Button>
                  )}
                  {message.role === "user" && (
                    <Button
                      className="secondary"
                      disabled={busy}
                      title="Edit and resend in a new branch"
                      onClick={() => {
                        setText(message.content);
                        replaceAttachments(message.attachments ?? []);
                        update(chat.id, (item) => ({
                          ...item,
                          mode: message.mode ?? "chat",
                        }));
                        setAction(message.action ?? "grammar");
                        setTerms(message.terms ?? "");
                        setInstruction(message.instruction ?? "");
                        setResend(chat.messages.slice(0, index));
                        composer.current?.focus();
                      }}
                    >
                      <Icon name="reuse" />
                      Edit & resend
                    </Button>
                  )}
                  {message.role === "assistant" && (
                    <>
                      <Button
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
                              user.terms ?? "",
                              user.instruction ?? "",
                            );
                        }}
                      >
                        <Icon name="undo" />
                        Retry
                      </Button>
                      <Button
                        className="secondary"
                        disabled={busy}
                        title="Continue from this reply in a new conversation branch"
                        onClick={() => {
                          const branch = {
                            ...newConversation(chat.mode),
                            title: `${chat.title.slice(0, 36)} (branch)`,
                            messages: chat.messages.slice(0, index + 1),
                          };
                          setChats((items) => [branch, ...items]);
                          setActive(branch.id);
                          setText("");
                          replaceAttachments([]);
                          setResend(null);
                          setEdit(null);
                          nearBottom.current = true;
                          setLatest(false);
                        }}
                      >
                        <Icon name="branch" />
                        Branch
                      </Button>
                      <Button
                        className="secondary"
                        disabled={busy || !message.content}
                        title="Edit this response"
                        onClick={() => {
                          setEdit(message.id);
                          setEditText(message.content);
                        }}
                      >
                        <Icon name="edit" />
                        Edit result
                      </Button>
                      <Button
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
                      </Button>
                    </>
                  )}
                </div>
                {message.mode === "write" &&
                  message.role === "assistant" &&
                  message.state !== "streaming" &&
                  message.content &&
                  missingTerms(
                    message.source ?? "",
                    message.content,
                    message.terms ?? "",
                  ).length > 0 && (
                    <p role="alert">
                      Review missing protected terms:{" "}
                      {missingTerms(
                        message.source ?? "",
                        message.content,
                        message.terms ?? "",
                      ).join(", ")}
                    </p>
                  )}
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
          <Button
            className="jump secondary"
            onClick={() => {
              nearBottom.current = true;
              setLatest(false);
              if (scroll.current)
                scroll.current.scrollTop = scroll.current.scrollHeight;
            }}
          >
            ↓ Jump to latest
          </Button>
        )}
        <section className="compose-area" aria-label="Message composer">
          {selection.trim() && (
            <Button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setText(selection);
                replaceAttachments([]);
                setSelection("");
                setResend(null);
                update(chat.id, (item) => ({ ...item, mode: "write" }));
                composer.current?.focus();
              }}
            >
              Rewrite selected text
            </Button>
          )}
          <div className="compose-options">
            <div className="mode-switch" role="group" aria-label="Mode">
              {(["chat", "write"] as const).map((mode) => (
                <Button
                  key={mode}
                  className="secondary"
                  aria-pressed={chat.mode === mode}
                  disabled={busy}
                  onClick={() => update(chat.id, (item) => ({ ...item, mode }))}
                >
                  {mode === "chat" ? "Chat" : "Write"}
                </Button>
              ))}
            </div>
            {chat.mode === "write" && (
              <div
                className="actions"
                role="group"
                aria-label="Writing actions"
              >
                {primaryActions.map((key) => (
                  <Button
                    key={key}
                    className="secondary"
                    aria-pressed={key === action}
                    title={actions[key].instruction}
                    disabled={busy}
                    onClick={() => setAction(key)}
                  >
                    <Icon name={key} />
                    {actions[key].label}
                  </Button>
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
          {chat.mode === "write" && (
            <details className="writing-preferences">
              <summary>Writing preferences · optional</summary>
              <label>
                Protected terms
                <input
                  value={terms}
                  maxLength={300}
                  disabled={busy}
                  onChange={(event) => setTerms(event.target.value)}
                  placeholder="PostgreSQL, Acme, API"
                />
              </label>
              <small>
                Comma-separated. Missing terms are flagged for review.
              </small>
              <label>
                Custom instruction
                <input
                  value={instruction}
                  maxLength={300}
                  disabled={busy}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder="Be polite but direct."
                />
              </label>
            </details>
          )}
          {resend !== null && (
            <div className="draft-note">
              Editing a previous request · original conversation will be kept.
              <Button className="secondary" onClick={() => setResend(null)}>
                Cancel edit
              </Button>
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
                setSelection(
                  el.value.slice(el.selectionStart, el.selectionEnd),
                );
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
                    <Button
                      className="secondary"
                      aria-label={`Remove ${file.name}`}
                      disabled={busy}
                      onClick={() =>
                        replaceAttachments((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            )}
            <div className="composer-footer">
              <input
                ref={files}
                className="sr-only"
                aria-label="Text file selection"
                tabIndex={-1}
                type="file"
                accept=".txt,.md,.markdown"
                multiple
                disabled={busy}
                onChange={async (event) => {
                  const request = ++attachmentRequest.current;
                  const selected = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  try {
                    const next = await readAttachments(selected);
                    if (request !== attachmentRequest.current) return;
                    replaceAttachments(next);
                    setFeedback("");
                  } catch (cause) {
                    if (request !== attachmentRequest.current) return;
                    setFeedback((cause as Error).message);
                  }
                }}
              />
              <Button
                className="secondary icon-button"
                aria-label="Attach text files"
                title="Attach up to 3 UTF-8 text or Markdown files, 24 KB total"
                disabled={busy}
                onClick={() => files.current?.click()}
              >
                <Icon name="attach" />
              </Button>
              <span className="muted keyboard-hint">
                Shift + Enter for a new line
              </span>
              <div className="run-bar">
                <ModelPicker
                  writer={writer}
                  model={model}
                  status={session.status}
                  supported={supported}
                  autoLoad={autoLoad}
                  onAutoLoad={(value) => {
                    setAutoLoad(value);
                    if (!setPreference("auto-load", String(value)))
                      setFeedback(
                        "Could not save the automatic loading preference.",
                      );
                  }}
                  onSelect={(id) => {
                    session.stop("");
                    setModel(id);
                    if (!setPreference("model", id))
                      setFeedback("Could not remember this model selection.");
                  }}
                  onLoad={() => void session.load(model)}
                  onRemove={() => void session.remove(model)}
                  onUnload={() => session.stop("")}
                />
                {busy ? (
                  <Button
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
                  </Button>
                ) : (
                  <Button
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
                  </Button>
                )}
              </div>
            </div>
          </div>
          {session.status === "loading" && (
            <LoadingStatus progress={session.progress} />
          )}
          {(session.error || feedback || session.notice) && (
            <p role="status" className="feedback">
              {session.error || feedback || session.notice}
            </p>
          )}
          {contextLabel && (
            <details className="context-budget">
              <summary>Context budget</summary>
              <p>{contextLabel}</p>
              <p>
                A conservative UTF-8 byte estimate, not an exact token count.
                Space is reserved for the reply.
              </p>
            </details>
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
            Model downloads contact Hugging Face and the runtime host. Messages
            and attachments are processed in this browser. No server or account
            is required. Review AI answers before using them.
          </p>
          <form method="dialog">
            <Button>
              <Icon name="close" />
              Close
            </Button>
          </form>
        </dialog>
      </main>
    </div>
  );
}
