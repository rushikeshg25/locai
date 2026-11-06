import { useState, useEffect, useRef } from "react";
import { Icon } from "../../shared/ui/Icon";
import { Button } from "../../shared/ui/Button";
import type { Conversation } from "./conversations";
export function ConversationSidebar({
  chats,
  active,
  busy,
  onSelect,
  onNew,
  onRename,
  onPin,
  onDelete,
  open = true,
  onOpen,
}: {
  onRename?: (id: string, title: string) => void;
  onPin?: (id: string) => void;
  onDelete?: (id: string) => void;
  open?: boolean;
  onOpen?: (open: boolean) => void;
  onNew?: () => void;
  chats: Conversation[];
  active: string;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!menu) return;
    menuPanel.current?.querySelector("button")?.focus();
    const outside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !menuPanel.current?.contains(event.target) &&
        !menuTrigger.current?.contains(event.target)
      )
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        menuTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [menu]);
  useEffect(() => {
    setMenu(null);
    setRenaming(null);
  }, [open]);
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
  filtered.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const menuChat = chats.find((chat) => chat.id === menu?.id);
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
        <div className="sidebar-heading-actions">
          {onNew && (
            <Button
              className="new-chat icon-button"
              aria-label="New chat"
              title="New chat"
              disabled={busy}
              onClick={() => {
                setQuery("");
                onNew();
                if (mobile) onOpen?.(false);
              }}
            >
              <Icon name="plus" />
            </Button>
          )}
          <Button
            className="icon-button secondary"
            aria-label="Collapse chats"
            title="Collapse chats"
            onClick={() => onOpen?.(false)}
          >
            <Icon name="sidebar" />
          </Button>
        </div>
      </div>
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
      <nav aria-label="Conversations" onScroll={() => setMenu(null)}>
        {filtered.map((chat) => (
          <div
            className={`chat-row ${chat.id === active ? "active" : ""}`}
            key={chat.id}
            data-chat-id={chat.id}
          >
            {renaming === chat.id ? (
              <form
                className="chat-rename"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (title.trim()) {
                    onRename?.(chat.id, title.trim());
                    setRenaming(null);
                  }
                }}
              >
                <input
                  aria-label="Chat title"
                  autoFocus
                  maxLength={80}
                  value={title}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="secondary"
                  aria-label="Save title"
                >
                  <Icon name="grammar" />
                </button>
              </form>
            ) : (
              <>
                <button
                  className="secondary chat-select"
                  aria-current={chat.id === active ? "page" : undefined}
                  disabled={busy}
                  aria-label={`Open chat: ${chat.title}`}
                  onClick={() => {
                    setMenu(null);
                    onSelect(chat.id);
                    if (mobile) onOpen?.(false);
                  }}
                >
                  <span>{chat.title}</span>
                </button>
                <div
                  className={`chat-row-actions ${menu?.id === chat.id ? "is-open" : ""}`}
                >
                  <button
                    className="secondary"
                    aria-label={`Options for ${chat.title}`}
                    title="Chat options"
                    disabled={busy}
                    aria-expanded={menu?.id === chat.id}
                    aria-controls={
                      menu?.id === chat.id ? "chat-row-menu" : undefined
                    }
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      menuTrigger.current = event.currentTarget;
                      setMenu(
                        menu?.id === chat.id
                          ? null
                          : {
                              id: chat.id,
                              left: Math.max(
                                8,
                                Math.min(rect.left, innerWidth - 188),
                              ),
                              top: Math.max(
                                8,
                                Math.min(rect.bottom + 4, innerHeight - 160),
                              ),
                            },
                      );
                    }}
                  >
                    <Icon name="more" />
                  </button>
                  <button
                    className="secondary"
                    aria-label={`${chat.pinned ? "Unpin" : "Pin"} chat: ${chat.title}`}
                    title={chat.pinned ? "Unpin chat" : "Pin chat"}
                    aria-pressed={!!chat.pinned}
                    disabled={busy}
                    onClick={() => onPin?.(chat.id)}
                  >
                    <Icon name="pin" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!filtered.length && (
          <p className="muted">No matching conversations.</p>
        )}
      </nav>
      {menu && menuChat && (
        <div
          id="chat-row-menu"
          className="chat-row-menu"
          ref={menuPanel}
          role="group"
          aria-label={`Actions for ${menuChat.title}`}
          style={{ top: menu.top, left: menu.left }}
        >
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setTitle(menuChat.title);
              setRenaming(menuChat.id);
              setMenu(null);
            }}
          >
            <Icon name="edit" />
            Rename
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              onPin?.(menuChat.id);
              setMenu(null);
              menuTrigger.current?.focus();
            }}
          >
            <Icon name="pin" />
            {menuChat.pinned ? "Unpin" : "Pin"} chat
          </button>
          <button
            className="secondary danger"
            disabled={busy}
            onClick={() => {
              onDelete?.(menuChat.id);
              setMenu(null);
            }}
          >
            <Icon name="clear" />
            Delete chat
          </button>
        </div>
      )}
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
