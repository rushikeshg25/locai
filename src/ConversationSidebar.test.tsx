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
  expect(screen.getByRole("button", { name: /First/ })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Weekend/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search conversations"), {
    target: { value: "weekend" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Weekend/ }));
  expect(select).toHaveBeenCalledWith(second.id);
});
