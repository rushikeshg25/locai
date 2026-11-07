import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConversationSidebar } from "./ConversationSidebar";
import { newConversation } from "./conversations";
afterEach(cleanup);
it("searches titles and message contents and switches chats", () => {
  const first = {
    ...newConversation(),
    title: "First",
    messages: [{ id: "m", role: "user" as const, content: "PostgreSQL notes" }],
  };
  const second = { ...newConversation(), title: "Weekend" };
  const select = vi.fn();
  render(
    <ConversationSidebar
      chats={[first, second]}
      active={first.id}
      busy={false}
      onSelect={select}
    />,
  );
  fireEvent.change(screen.getByLabelText("Search conversations"), {
    target: { value: "postgresql" },
  });
  expect(
    screen.getByRole("button", { name: "Open chat: First" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Open chat: Weekend" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search conversations"), {
    target: { value: "weekend" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open chat: Weekend" }));
  expect(select).toHaveBeenCalledWith(second.id);
});

it("orders recent chats by activity while keeping pinned chats first", () => {
  const chats = [
    { ...newConversation(), title: "Older", updatedAt: 1 },
    { ...newConversation(), title: "Recent", updatedAt: 3 },
    { ...newConversation(), title: "Pinned", updatedAt: 0, pinned: true },
  ];
  render(
    <ConversationSidebar
      chats={chats}
      active={chats[0].id}
      busy={false}
      onSelect={vi.fn()}
    />,
  );
  expect(
    screen
      .getAllByRole("button", { name: /^Open chat:/ })
      .map((item) => item.getAttribute("aria-label")),
  ).toEqual(["Open chat: Pinned", "Open chat: Recent", "Open chat: Older"]);
});
