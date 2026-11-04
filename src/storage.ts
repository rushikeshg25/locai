import { actions } from "./actions";
import { type Conversation, type Message, messageText } from "./conversations";
const PREFIX = "local-writer-chat-v1:";
const LIMIT = 2_000_000;
function validMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const m = value as Message;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    (m.action === undefined || Object.hasOwn(actions, m.action)) &&
    (m.mode === undefined || m.mode === "chat" || m.mode === "write") &&
    (m.attachments === undefined ||
      (Array.isArray(m.attachments) &&
        m.attachments.every(
          (a) =>
            a && typeof a.name === "string" && typeof a.content === "string",
        ))) &&
    (m.modelLabel === undefined || typeof m.modelLabel === "string") &&
    (m.source === undefined || typeof m.source === "string") &&
    (m.model === undefined || typeof m.model === "string") &&
    (m.omitted === undefined ||
      (Number.isInteger(m.omitted) && m.omitted >= 0)) &&
    (m.truncated === undefined || typeof m.truncated === "boolean") &&
    (m.state === undefined ||
      ["streaming", "complete", "stopped", "error"].includes(m.state))
  );
}
export function readSaved(): { chats: Conversation[]; warning: string } {
  const chats: Conversation[] = [];
  let warning = "";
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key)!;
        if (raw.length > LIMIT) throw new Error();
        const value = JSON.parse(raw) as Conversation;
        if (
          !value ||
          key !== PREFIX + value.id ||
          typeof value.id !== "string" ||
          typeof value.title !== "string" ||
          !Number.isFinite(value.updatedAt) ||
          new Set(value.messages?.map((message: Message) => message?.id))
            .size !== value.messages?.length ||
          !["chat", "write"].includes(value.mode) ||
          !Array.isArray(value.messages) ||
          !value.messages.every(validMessage)
        )
          throw new Error();
        chats.push({
          ...value,
          saved: true,
          messages: value.messages.map((message) => ({
            ...message,
            state: message.state === "streaming" ? "stopped" : message.state,
          })),
        });
      } catch {
        warning =
          "A saved conversation could not be read. Its stored data was left untouched.";
      }
    }
  } catch {
    warning = "Browser storage is unavailable. Chats will remain temporary.";
  }
  return { chats: chats.sort((a, b) => b.updatedAt - a.updatedAt), warning };
}
export function saveChat(chat: Conversation) {
  const raw = JSON.stringify({ ...chat, saved: true });
  if (raw.length > LIMIT)
    throw new Error(
      "This conversation is too large to save. Export it instead.",
    );
  localStorage.setItem(PREFIX + chat.id, raw);
}
export function forgetChat(id: string) {
  localStorage.removeItem(PREFIX + id);
}
export function exportMarkdown(chat: Conversation) {
  return (
    `# ${chat.title}\n\n` +
    chat.messages
      .map(
        (message) =>
          `## ${message.role === "user" ? "You" : (message.modelLabel ?? "Assistant")}${message.state && message.state !== "complete" ? ` (${message.state})` : ""}\n\n${messageText(message)}`,
      )
      .join("\n\n---\n\n")
  );
}
export async function readAttachments(files: File[]) {
  if (files.length > 3)
    throw new Error("Attach up to 3 text or Markdown files.");
  if (files.reduce((sum, file) => sum + file.size, 0) > 24_000)
    throw new Error(
      "Attachments must total 24 KB or less. The model context limit still applies.",
    );
  return Promise.all(
    files.map(async (file) => {
      if (!/\.(txt|md|markdown)$/i.test(file.name))
        throw new Error("Only .txt, .md and .markdown files are supported.");
      const bytes = await file.arrayBuffer();
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error(`${file.name} must be UTF-8 text.`);
      }
      if (content.includes("\0"))
        throw new Error(`${file.name} contains binary data.`);
      return { name: file.name, content };
    }),
  );
}
