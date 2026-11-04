import type { Action } from "./actions";
export type Mode = "chat" | "write";
export interface Attachment {
  name: string;
  content: string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  modelLabel?: string;
  mode?: Mode;
  action?: Action;
  state?: "streaming" | "complete" | "stopped" | "error";
  source?: string;
  attachments?: Attachment[];
  omitted?: number;
  truncated?: boolean;
}
export interface Conversation {
  id: string;
  title: string;
  mode: Mode;
  messages: Message[];
  updatedAt: number;
  saved: boolean;
}
export function newConversation(mode: Mode = "chat"): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    mode,
    messages: [],
    updatedAt: Date.now(),
    saved: false,
  };
}
export function messageText(message: Pick<Message, "content" | "attachments">) {
  return (
    message.content +
    (message.attachments ?? [])
      .map(
        (file) =>
          `\n\n<attachment name=${JSON.stringify(file.name)}>\n${file.content}\n</attachment>`,
      )
      .join("")
  );
}
export function conversationHistory(messages: Message[]) {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i],
      reply = messages[i + 1];
    if (
      user.role === "user" &&
      reply.role === "assistant" &&
      reply.state === "complete"
    ) {
      history.push(
        { role: "user", content: messageText(user) },
        { role: "assistant", content: reply.content },
      );
      i++;
    }
  }
  return history;
}
