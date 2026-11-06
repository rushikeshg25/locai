import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import type { Conversation } from "./conversations";
export function ConversationSidebar({
  chats,
  active,
  busy,
  onSelect,
  onNew,
  open = true,
  onOpen,
}: {
  open?: boolean;
  onOpen?: (open: boolean) => void;
  onNew?: () => void;
  chats: Conversation[];
  active: string;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(false);
  useEffect(() => {
    if (open && focusSearch.current) {
      search.current?.focus();
      focusSearch.current = false;
    }
  }, [open]);
  const filtered = chats.filter((chat) =>
    `${chat.title} ${chat.messages.map((message) => message.content).join(" ")}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.("(max-width: 900px)").matches ?? false,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (!media) return;
    const change = () => {
      setMobile(media.matches);
      onOpen?.(!media.matches);
    };
    media.addEventListener("change", change);
    // Catch a resize between the first render and listener registration.
    if (media.matches !== mobile) change();
    return () => media.removeEventListener("change", change);
  }, [onOpen, mobile]);
  useEffect(() => {
    if (mobile && open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mobile, open]);
  const content = (
    <>
      <div className="sidebar-heading">
        <h2>Chats</h2>
        <Button
          className="icon-button secondary"
          aria-label="Collapse chats"
          onClick={() => onOpen?.(false)}
        >
          <Icon name="sidebar" />
        </Button>
      </div>
      {onNew && (
        <Button
          className="new-chat"
          disabled={busy}
          onClick={() => {
            setQuery("");
            onNew();
            if (mobile) onOpen?.(false);
          }}
        >
          <Icon name="edit" />
          New chat
        </Button>
      )}
      <label className="sr-only" htmlFor="chat-search">
        Search conversations
      </label>
      <div className="chat-search-field">
        <Icon name="search" />
        <input
          ref={search}
          id="chat-search"
          type="search"
          placeholder="Search chats"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="sidebar-section-label">Recent chats</p>
      <nav aria-label="Conversations">
        {filtered.map((chat) => (
          <Button
            key={chat.id}
            className="secondary"
            data-chat-id={chat.id}
            aria-current={chat.id === active ? "page" : undefined}
            disabled={busy}
            aria-label={`Open chat: ${chat.title}`}
            onClick={() => {
              onSelect(chat.id);
              if (mobile) onOpen?.(false);
            }}
          >
            <span>{chat.title}</span>
            {chat.saved && (
              <span className="saved-indicator" aria-label="Saved on device">
                <Icon name="save" />
              </span>
            )}
          </Button>
        ))}
        {!filtered.length && (
          <p className="muted">No matching conversations.</p>
        )}
      </nav>
    </>
  );
  return mobile ? (
    <dialog
      ref={dialog}
      className="chat-drawer"
      aria-label="Chat history"
      onCancel={() => onOpen?.(false)}
      onClick={(event) => {
        if (event.target === dialog.current) onOpen?.(false);
      }}
    >
      <div className="conversation-sidebar">{content}</div>
    </dialog>
  ) : !open ? (
    <aside className="chat-rail" aria-label="Chat navigation">
      <Button
        className="icon-button secondary"
        aria-label="Expand chats"
        title="Expand chats"
        onClick={() => onOpen?.(true)}
      >
        <Icon name="sidebar" />
      </Button>
      {onNew && (
        <Button
          className="icon-button secondary"
          aria-label="New chat"
          title="New chat"
          disabled={busy}
          onClick={() => {
            setQuery("");
            onNew();
          }}
        >
          <Icon name="edit" />
        </Button>
      )}
      <Button
        className="icon-button secondary"
        aria-label="Search chats"
        title="Search chats"
        onClick={() => {
          focusSearch.current = true;
          onOpen?.(true);
        }}
      >
        <Icon name="search" />
      </Button>
    </aside>
  ) : (
    <aside
      className="conversation-sidebar"
      aria-label="Chat history"
      hidden={!open}
    >
      {content}
    </aside>
  );
}
