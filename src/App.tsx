import { SelectionCitation } from "./SelectionCitation";
import { useDismissibleDetails } from "./useDismissibleDetails";
import { searchWeb, fitSearch } from "./search";
import type { WritingRequest } from "./prompts";
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
import { actions, inputError, type Action } from "./actions";
import { LocalWriter, type Writer } from "./inference";
import { splitReasoning } from "./reasoning";
import { checkGPU, models, supportsReasoning } from "./models";
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
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !(window.matchMedia?.("(max-width: 900px)").matches ?? false),
  );
  const chatMenu = useRef<HTMLDetailsElement>(null);
  useDismissibleDetails(chatMenu);
  const [browserWriter] = useState(() => supplied ?? new LocalWriter());
  const writer = browserWriter;
  const [autoLoad, setAutoLoad] = useState(
    () => getPreference("auto-load", "true") === "true",
  );
  const autoAttempted = useRef(false);
  const session = useWriter(writer);
  const [webSearch, setWebSearch] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(
    () => getPreference("reasoning", "true") === "true",
  );
  const [searching, setSearching] = useState<string | null>(null);
  const searchController = useRef<AbortController | null>(null);
  useEffect(() => () => searchController.current?.abort(), []);
  const [modelRequired, setModelRequired] = useState(false);
  useEffect(() => {
    if (session.status === "ready") setModelRequired(false);
  }, [session.status]);
  const currentStatus = useRef(session.status);
  currentStatus.current = session.status;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>(preferredModel);
  const [saved] = useState(readSaved);
  const [chats, setChats] = useState<Conversation[]>(() =>
    saved.chats.length ? saved.chats : [newConversation()],
  );
  const [active, setActive] = useState("");
  const chat = chats.find((item) => item.id === active) ?? chats[0];
  const [text, setText] = useState("");
  const action: Action = "grammar";
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
  const persistedChats = useRef(
    new Map(saved.chats.map((item) => [item.id, item])),
  );
  useEffect(() => {
    function persist(includeStreaming: boolean) {
      for (const item of chats) {
        if (
          !item.saved ||
          !item.messages.length ||
          persistedChats.current.get(item.id) === item
        )
          continue;
        if (
          !includeStreaming &&
          persistedChats.current.has(item.id) &&
          item.messages.some((message) => message.state === "streaming")
        )
          continue;
        try {
          saveChat(item);
          persistedChats.current.set(item.id, item);
          persistFailures.current.delete(item.id);
        } catch {
          if (!persistFailures.current.has(item.id)) {
            setFeedback(
              "Could not save this chat in browser storage. Export it to keep your messages.",
            );
            persistFailures.current.add(item.id);
          }
        }
      }
    }
    persist(false);
    // Save settled chunks without writing localStorage on every streamed token.
    const timer = window.setTimeout(() => persist(true), 500);
    const flush = () => persist(true);
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [chats]);
  const [resend, setResend] = useState<Message[] | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [latest, setLatest] = useState(false);
  const info = useRef<HTMLDialogElement>(null);
  const busy =
    !!searching ||
    ["loading", "writing", "stopping", "removing"].includes(session.status);
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
    const input = composer.current;
    if (!input) return;
    const resize = () => {
      input.style.overflowY = "hidden";
      input.style.height = "auto";
      const height = input.scrollHeight;
      input.style.height = `${Math.min(height + 1, 240)}px`;
      input.style.overflowY = height > 240 ? "auto" : "hidden";
    };
    resize();
    if (typeof ResizeObserver === "undefined") return;
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) {
        width = input.clientWidth;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
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
  function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation and its saved copy?")) return;
    try {
      forgetChat(id);
      setChats((items) => {
        const remaining = items.filter((item) => item.id !== id);
        return remaining.length ? remaining : [newConversation()];
      });
      if (id === chat.id) {
        setActive("");
        setText("");
        replaceAttachments([]);
        setResend(null);
      }
    } catch {
      setFeedback(
        "Could not delete the saved copy. Browser storage may be blocked.",
      );
    }
  }
  function newChat() {
    const next = newConversation();
    setChats((items) => [next, ...items]);
    setActive(next.id);
    setText("");
    replaceAttachments([]);
    setResend(null);
    setFeedback("");

    nearBottom.current = true;
    setLatest(false);
  }
  function selectChat(id: string) {
    setActive(id);
    setText("");
    replaceAttachments([]);
    setResend(null);

    nearBottom.current = true;
    setLatest(false);
  }
  async function send(
    source = text,
    prefix = resend ?? chat.messages,
    fork = resend !== null,
    attached = attachments,
    requestMode: "chat" | "write" = "chat",
    requestAction = action,
    requestTerms = "",
    requestInstruction = "",
    useSearch = webSearch && requestMode === "chat",
    useReasoning = reasoningEnabled,
  ) {
    if (busy || searchController.current) return;
    if (session.status !== "ready") {
      setModelRequired(true);
      const picker = composer.current
        ?.closest(".composer")
        ?.querySelector<HTMLDetailsElement>(".model-settings");
      if (picker) {
        picker.open = true;
        picker.querySelector("summary")?.focus();
      }
      return;
    }
    const error = inputError(source);
    if (error) {
      setFeedback(error);
      return;
    }
    const reasoning =
      supportsReasoning(selected.id) && requestMode === "chat" && useReasoning;
    let request: WritingRequest = {
      reasoning,
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
      webSearch: useSearch,
      reasoningEnabled: reasoning,
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
      webSearch: useSearch,
      reasoningEnabled: reasoning,
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
        saved: chat.saved,
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
    setResend(null);
    setFeedback("");
    nearBottom.current = true;
    setLatest(false);
    if (useSearch) {
      const controller = new AbortController();
      searchController.current = controller;
      setSearching(answer.id);
      patch(id, answer.id, { searchQuery: source.trim().slice(0, 300) });
      try {
        const sources = await searchWeb(source, controller.signal);
        if (controller.signal.aborted) throw new Error("Search cancelled.");
        const fitted = fitSearch(request, sources);
        request = fitted.request;
        patch(id, answer.id, {
          webSources: request.webSources,
          omitted: fitted.budget.omitted,
        });
      } catch (cause) {
        patch(id, answer.id, {
          state: controller.signal.aborted ? "stopped" : "error",
          searchError: controller.signal.aborted
            ? "Search cancelled."
            : cause instanceof Error
              ? cause.message
              : "Search failed. Please retry.",
        });
        return;
      } finally {
        if (searchController.current === controller) {
          searchController.current = null;
          setSearching(null);
        }
      }
    }
    const parse = (content: string) =>
      supportsReasoning(selected.id) ? splitReasoning(content) : { content };
    const result = await session.run(
      request,
      (content) => patch(id, answer.id, parse(content)),
      !fork && chat.messages.length === 0
        ? {
            firstMessage: source,
            onTitle: (title) => update(id, (item) => ({ ...item, title })),
          }
        : undefined,
    );
    patch(id, answer.id, {
      ...parse(result.text),
      state: result.state,
      truncated: result.truncated,
    });
  }
  let contextUsage = 0;
  if (text.trim() || chat.messages.length) {
    try {
      const budget = prepareMessages({
        reasoning: reasoningEnabled && supportsReasoning(selected.id),
        text: messageText({ content: text, attachments }),
        mode: "chat",
        action,
        terms: "",
        instruction: "",
        history: conversationHistory(resend ?? chat.messages),
        contextWindow: 4096,
      });
      contextUsage = budget.used / budget.budget;
    } catch {
      // Sending still reports the full budget error; show a full ring meanwhile.
      contextUsage = 1;
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
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <a
        className="skip-link"
        href="#source"
        onClick={(event) => {
          event.preventDefault();
          composer.current?.focus();
        }}
      >
        Skip to message
      </a>
      <ConversationSidebar
        chats={chats}
        active={chat.id}
        busy={busy}
        onSelect={selectChat}
        open={sidebarOpen}
        onOpen={setSidebarOpen}
        onNew={newChat}
        onRename={(id, title) => update(id, (item) => ({ ...item, title }))}
        onPin={(id) =>
          update(id, (item) => ({ ...item, pinned: !item.pinned }))
        }
        onDelete={deleteChat}
      />
      <main className="workspace">
        <header>
          <div className="workspace-heading">
            <Button
              className="icon-button secondary"
              aria-label="Open chats"
              title="Show chats"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="sidebar" />
            </Button>
            <h1 className="app-brand">
              <img src="/icons/locai.svg" width="24" height="24" alt="" />
              Locai
            </h1>
          </div>
          <div className="header-tools">
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
              aria-label="About Locai"
              title="About Locai"
              onClick={() => info.current?.showModal()}
            >
              <Icon name="info" />
            </Button>
            <div className="chat-controls">
              <details ref={chatMenu} className="chat-menu">
                <summary aria-label="Chat options">
                  <Icon name="more" />
                </summary>
                <div className="chat-menu-panel">
                  <Button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      try {
                        if (chat.saved) {
                          forgetChat(chat.id);
                          update(chat.id, (item) => ({
                            ...item,
                            saved: false,
                          }));
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
                      link.download = "locai-chat.md";
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
                    onClick={() => deleteChat(chat.id)}
                  >
                    <Icon name="clear" />
                    Delete
                  </Button>
                </div>
              </details>
            </div>
          </div>
        </header>
        {supported === false && (
          <p role="alert" className="banner">
            WebGPU is unavailable. Use a recent desktop browser with hardware
            acceleration, on HTTPS or localhost.
          </p>
        )}
        <div
          className="transcript"
          tabIndex={0}
          aria-label="Chat messages"
          ref={scroll}
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
                <div className="message-body">
                  <div className="message-heading">
                    <strong>
                      {message.role === "user"
                        ? "You"
                        : (message.modelLabel ?? "Assistant")}
                    </strong>
                    {message.mode === "write" && (
                      <small>
                        {actions[message.action ?? "grammar"].label}
                      </small>
                    )}
                  </div>
                  {message.role === "assistant" &&
                    (message.reasoning || message.thinking) && (
                      <details className="reasoning-block">
                        <summary>
                          {message.state === "streaming" && message.thinking
                            ? "Thinking…"
                            : message.thinking
                              ? "Thinking interrupted"
                              : "Thinking"}
                        </summary>
                        <div className="reasoning-text">
                          {message.reasoning || "Preparing…"}
                        </div>
                      </details>
                    )}
                  {message.role === "assistant" &&
                    message.reasoning &&
                    !message.content &&
                    message.state !== "streaming" && (
                      <p className="muted">
                        No final answer was produced. Reasoning may have reached
                        the output limit or been interrupted.
                      </p>
                    )}
                  <div className="message-content">
                    {message.role === "user" ? (
                      <p className="user-text">{message.content}</p>
                    ) : (
                      message.content && (
                        <Markdown
                          text={message.content}
                          sources={message.webSources}
                        />
                      )
                    )}
                  </div>
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
                      <span>
                        {searching === message.id
                          ? "Searching the web…"
                          : message.content
                            ? "Responding…"
                            : "Thinking…"}
                      </span>
                    </div>
                  )}
                  {message.searchQuery && (
                    <small className="search-query">
                      {searching === message.id ? "Searching" : "Searched"}:{" "}
                      {message.searchQuery}
                    </small>
                  )}
                  {message.searchError && (
                    <p role="alert">{message.searchError}</p>
                  )}
                  {!!message.webSources?.length && (
                    <details className="web-sources">
                      <summary>Sources · {message.webSources.length}</summary>
                      <ol>
                        {message.webSources.map((source) => (
                          <li key={source.url}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {source.title}
                            </a>
                            <small>{new URL(source.url).hostname}</small>
                            <p>{source.snippet}</p>
                          </li>
                        ))}
                      </ol>
                    </details>
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
                </div>
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
                              user.webSearch ?? false,
                              user.reasoningEnabled ?? false,
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
                            ...newConversation(),
                            saved: chat.saved,
                            title: `${chat.title.slice(0, 36)} (branch)`,
                            messages: chat.messages.slice(0, index + 1),
                          };
                          setChats((items) => [branch, ...items]);
                          setActive(branch.id);
                          setText("");
                          replaceAttachments([]);
                          setResend(null);

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
        <SelectionCitation
          container={scroll}
          disabled={busy}
          conversation={chat.id}
          onCite={(quote) => {
            setText(
              (draft) =>
                `${draft}${draft.trim() ? "\n\n" : ""}${quote
                  .split("\n")
                  .map((line) => `> ${line}`)
                  .join("\n")}\n\n`,
            );
            composer.current?.focus();
          }}
        />
        <section className="compose-area" aria-label="Message composer">
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
              aria-describedby="composer-shortcuts"
              aria-keyshortcuts="Enter Control+Enter Shift+Enter"
              rows={2}
              value={text}
              disabled={busy}
              onChange={(event) => {
                setText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229 &&
                  (event.ctrlKey || event.metaKey)
                ) {
                  event.preventDefault();
                  const input = event.currentTarget;
                  const start = input.selectionStart;
                  const end = input.selectionEnd;
                  setText(text.slice(0, start) + "\n" + text.slice(end));
                  requestAnimationFrame(() =>
                    input.setSelectionRange(start + 1, start + 1),
                  );
                  return;
                }
                if (
                  event.key === "Enter" &&
                  !event.altKey &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Message…"
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
              <Button
                className="secondary web-search-toggle"
                aria-label="Search the web"
                aria-pressed={webSearch}
                title="Search the web · sends this question to search engines"
                disabled={busy}
                onClick={() => setWebSearch(!webSearch)}
              >
                <Icon name="search" />
                Web
              </Button>
              <span id="composer-shortcuts" className="sr-only">
                Enter to send · Ctrl/⌘ + Enter or Shift + Enter for a new line
              </span>
              <div className="run-bar">
                <ModelPicker
                  writer={writer}
                  model={model}
                  status={searching ? "searching" : session.status}
                  progress={session.progress}
                  contextUsage={contextUsage}
                  required={modelRequired}
                  supported={supported}
                  autoLoad={autoLoad}
                  reasoning={reasoningEnabled}
                  reasoningAllowed={true}
                  onReasoning={(value) => {
                    setReasoningEnabled(value);
                    if (!setPreference("reasoning", String(value)))
                      setFeedback("Reasoning preference could not be saved.");
                  }}
                  onAutoLoad={(value) => {
                    setAutoLoad(value);
                    if (!setPreference("auto-load", String(value)))
                      setFeedback(
                        "Could not save the automatic loading preference.",
                      );
                  }}
                  onSelect={(id) => {
                    if (id === model && session.status === "ready") return;
                    session.stop("");
                    setModel(id);
                    void session.load(id);
                    if (!setPreference("model", id))
                      setFeedback("Could not remember this model selection.");
                  }}
                  onRemove={(id) => void session.remove(id)}
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
                    onClick={() =>
                      searchController.current
                        ? searchController.current.abort()
                        : session.stop()
                    }
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
                    disabled={!!inputError(text)}
                    onClick={() => void send()}
                  >
                    <Icon name="send" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {(session.error || feedback || session.notice) && (
            <p role="status" className="feedback transient-notice">
              {session.error || feedback || session.notice}
            </p>
          )}
          {text && inputError(text) && (
            <p role="alert" className="transient-notice">
              {inputError(text)}
            </p>
          )}
        </section>
        <dialog
          ref={info}
          className="info-dialog"
          aria-labelledby="info-title"
          onClick={(event) => {
            if (event.target === info.current) info.current?.close();
          }}
        >
          <h2 id="info-title">About Locai</h2>
          <p>
            Browser models run on this device. Chats and attachments save
            automatically in this browser until deleted. Choose Make temporary
            in Chat options to keep a conversation only for this session.
          </p>
          <p>
            Model downloads contact Hugging Face and the runtime host. Messages
            and attachments are processed in this browser. Optional web search
            sends the current question to search engines through the search
            service. No account is required. Review AI answers before using
            them.
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
