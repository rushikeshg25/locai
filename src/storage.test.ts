import { afterEach, expect, it } from "vitest";
import { newConversation, conversationHistory } from "./conversations";
import {
  readSaved,
  saveChat,
  forgetChat,
  exportMarkdown,
  readAttachments,
} from "./storage";
afterEach(() => localStorage.clear());
it("only retains explicitly saved chats and forgets saved copies", () => {
  const chat = newConversation();
  chat.title = "Example";
  chat.messages = [
    {
      id: "1",
      role: "user",
      content: "Hello",
      attachments: [{ name: "note.md", content: "A fact" }],
    },
  ];
  expect(readSaved().chats).toEqual([]);
  saveChat(chat);
  expect(readSaved().chats[0].messages).toEqual(chat.messages);
  expect(exportMarkdown(chat)).toContain("A fact");
  forgetChat(chat.id);
  expect(readSaved().chats).toEqual([]);
});
it("leaves malformed stored records untouched and reports them", () => {
  localStorage.setItem("local-writer-chat-v1:bad", "{bad");
  expect(readSaved().warning).not.toBe("");
  expect(localStorage.getItem("local-writer-chat-v1:bad")).toBe("{bad");
});
it("does not include interrupted answers in model context", () => {
  expect(
    conversationHistory([
      { id: "1", role: "user", content: "Hi" },
      { id: "2", role: "assistant", content: "Partial", state: "stopped" },
    ]),
  ).toEqual([]);
});
it("rejects unsupported or oversized attachments", async () => {
  await expect(
    readAttachments([new File(["x"], "program.exe")]),
  ).rejects.toThrow("Only");
  await expect(
    readAttachments([new File(["x".repeat(24001)], "note.txt")]),
  ).rejects.toThrow("24 KB");
});
it("rejects malformed message metadata before it can reach rendering", () => {
  const chat = newConversation();
  chat.messages = [
    { id: "1", role: "assistant", content: "reply", omitted: 1 },
  ];
  const invalid = {
    ...chat,
    messages: [{ ...chat.messages[0], omitted: { bad: true } }],
  };
  localStorage.setItem(
    `local-writer-chat-v1:${chat.id}`,
    JSON.stringify(invalid),
  );
  expect(readSaved().chats).toHaveLength(0);
  expect(readSaved().warning).toContain("could not be read");
});
