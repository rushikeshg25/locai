import { useState } from "react";
import { Button } from "./Button";
import type { Conversation } from "./conversations";
export function ConversationSidebar({
  chats,
  active,
  busy,
  onSelect,
}: {
  chats: Conversation[];
  active: string;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = chats.filter((chat) =>
    `${chat.title} ${chat.messages.map((message) => message.content).join(" ")}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <aside className="conversation-sidebar" aria-label="Chat history">
      <h2>Your chats</h2>
      <label className="sr-only" htmlFor="chat-search">
        Search conversations
      </label>
      <input
        id="chat-search"
        type="search"
        placeholder="Search conversations"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <nav aria-label="Conversations">
        {filtered.map((chat) => (
          <Button
            key={chat.id}
            className="secondary"
            data-chat-id={chat.id}
            aria-current={chat.id === active ? "page" : undefined}
            disabled={busy}
            onClick={() => onSelect(chat.id)}
          >
            <span>{chat.title}</span>
            <small>{chat.saved ? "Saved on device" : "Temporary"}</small>
          </Button>
        ))}
        {!filtered.length && (
          <p className="muted">No matching conversations.</p>
        )}
      </nav>
      <p className="muted">
        Temporary chats disappear when this tab closes. Save a chat to keep it
        on this device.
      </p>
    </aside>
  );
}
