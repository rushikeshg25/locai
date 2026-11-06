import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { newConversation } from "./conversations";
import { saveChat } from "./storage";
import type { Writer } from "./inference";
vi.mock("./inference", () => ({ LocalWriter: class {} }));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup(supported = true, cached = false) {
  const writer: Writer = {
    load: vi.fn().mockResolvedValue(undefined),
    cached: vi.fn().mockResolvedValue(cached),
    remove: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    generate: vi.fn(async (_request, chunk) => {
      chunk("We might ship Friday.");
      return { truncated: false };
    }),
  };
  render(<App writer={writer} gpuCheck={() => Promise.resolve(supported)} />);
  return writer;
}
async function ready() {
  fireEvent.click(screen.getByLabelText("Models"));
  const load = await screen.findByRole("button", { name: "Download model" });
  await waitFor(() => expect(load).toBeEnabled());
  fireEvent.click(load);
  await screen.findByRole("button", { name: "Model ready" });
}
async function send(text = "Hello") {
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument(),
  );
}
it("requires explicit loading and disables unsupported devices", async () => {
  const writer = setup(false);
  await screen.findByText(/WebGPU is unavailable/);
  fireEvent.click(screen.getByLabelText("Models"));
  expect(screen.getByRole("button", { name: "Download model" })).toBeDisabled();
  expect(writer.load).not.toHaveBeenCalled();
});
it("defaults to chat and sends prior completed messages", async () => {
  const writer = setup();
  await ready();
  await send("Remember Friday");
  await send("Which day?");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mode: "chat",
      text: "Which day?",
      history: [
        { role: "user", content: "Remember Friday" },
        { role: "assistant", content: "We might ship Friday." },
      ],
    }),
    expect.any(Function),
  );
  expect(screen.getAllByLabelText("Assistant message")).toHaveLength(2);
});
it("starts an empty chat without unloading the model", async () => {
  const writer = setup();
  await ready();
  await send();
  const calls = vi.mocked(writer.dispose).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
  expect(screen.queryByLabelText("Assistant message")).not.toBeInTheDocument();
  expect(writer.dispose).toHaveBeenCalledTimes(calls);
  await send("New topic");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({ history: [] }),
    expect.any(Function),
  );
});
it("handles writing requests directly in chat without a mode selector", async () => {
  const writer = setup();
  await ready();
  expect(
    screen.queryByRole("button", { name: "Write" }),
  ).not.toBeInTheDocument();
  await send("Make this warmer: Send the report.");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mode: "chat",
      text: "Make this warmer: Send the report.",
    }),
    expect.any(Function),
  );
});
it("preserves failed messages and forks a retry", async () => {
  const writer = setup();
  vi.mocked(writer.generate).mockRejectedValueOnce(new Error("lost device"));
  await ready();
  await send("My draft");
  await screen.findByText(/Generation failed/);
  expect(
    screen.getByText("My draft", { selector: ".user-text" }),
  ).toBeInTheDocument();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("We might ship Friday.");
  expect(
    screen
      .getByRole("navigation", { name: "Conversations" })
      .querySelectorAll(".chat-select"),
  ).toHaveLength(2);
});
it("edit and resend keeps the original branch", async () => {
  const writer = setup();
  await ready();
  await send("First");
  fireEvent.click(screen.getByRole("button", { name: "Edit & resend" }));
  await send("Changed");
  expect(
    screen
      .getByRole("navigation", { name: "Conversations" })
      .querySelectorAll(".chat-select"),
  ).toHaveLength(2);
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "Changed", history: [] }),
    expect.any(Function),
  );
});
it("Enter sends but composition and Shift Enter do not", async () => {
  const writer = setup();
  await ready();
  const input = screen.getByLabelText("Your text");
  fireEvent.change(input, { target: { value: "Hello" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(writer.generate).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(writer.generate).toHaveBeenCalledOnce());
});
it("rejects overlong drafts", async () => {
  setup();
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "word ".repeat(501) },
  });
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
});
it("renders Markdown safely without remote images or executable HTML", async () => {
  const writer = setup();
  vi.mocked(writer.generate).mockImplementation(async (_, chunk) => {
    chunk(
      "**Bold** <script>alert(1)</script> ![remote](https://example.com/a.png) [bad](javascript:alert(1))",
    );
    return { truncated: false };
  });
  await ready();
  await send();
  expect(screen.getByText("Bold").tagName).toBe("STRONG");
  expect(document.querySelector(".markdown script")).toBeNull();
  expect(document.querySelector(".markdown img")).toBeNull();
  expect(screen.getByText("bad")).not.toHaveAttribute(
    "href",
    "javascript:alert(1)",
  );
});
it("automatically saves messages, restores history and can make it temporary", async () => {
  setup();
  await ready();
  await send("Keep this");
  expect(
    Object.keys(localStorage).filter((key) =>
      key.startsWith("local-writer-chat"),
    ),
  ).toHaveLength(1);
  expect(screen.queryByLabelText("Saved on device")).not.toBeInTheDocument();
  cleanup();
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Open chat: Keep this" }));
  expect(screen.getByText("We might ship Friday.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Make temporary" }));
  expect(
    Object.keys(localStorage).filter((key) =>
      key.startsWith("local-writer-chat"),
    ),
  ).toHaveLength(0);
});
it("keeps draft selection local without changing the request mode", async () => {
  const writer = setup();
  await ready();
  const input = screen.getByLabelText("Your text") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Keep this. Fix these." } });
  input.setSelectionRange(11, 21);
  fireEvent.select(input);
  expect(
    screen.queryByRole("button", { name: "Cite" }),
  ).not.toBeInTheDocument();
  expect(input).toHaveValue("Keep this. Fix these.");
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(writer.generate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "chat", text: "Keep this. Fix these." }),
      expect.any(Function),
    ),
  );
});
it("loads downloaded weights automatically by default", async () => {
  const writer = setup(true, true);
  await waitFor(() => expect(writer.load).toHaveBeenCalledOnce());
});
it("can branch from a reply without making another model request", async () => {
  const writer = setup();
  await ready();
  await send("Original");
  fireEvent.click(screen.getByRole("button", { name: "Branch" }));
  expect(writer.generate).toHaveBeenCalledOnce();
  expect(
    screen
      .getByRole("navigation", { name: "Conversations" })
      .querySelectorAll(".chat-select"),
  ).toHaveLength(2);
  await send("Continue here");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      history: [
        { role: "user", content: "Original" },
        { role: "assistant", content: "We might ship Friday." },
      ],
    }),
    expect.any(Function),
  );
});
it("keeps the reader's scroll position during streaming and offers jump to latest", async () => {
  const writer = setup();
  let emit!: (text: string) => void;
  let finish!: (value: { truncated: boolean }) => void;
  vi.mocked(writer.generate).mockImplementation((_request, chunk) => {
    emit = chunk;
    return new Promise((resolve) => (finish = resolve));
  });
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "Long response" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  const transcript = document.querySelector(".transcript")!;
  Object.defineProperty(transcript, "scrollHeight", {
    configurable: true,
    value: 2000,
  });
  Object.defineProperty(transcript, "clientHeight", {
    configurable: true,
    value: 500,
  });
  transcript.scrollTop = 100;
  fireEvent.scroll(transcript);
  await import("@testing-library/react").then(({ act }) =>
    act(() => emit("More content")),
  );
  expect(transcript.scrollTop).toBe(100);
  fireEvent.click(screen.getByRole("button", { name: /Jump to latest/ }));
  expect(transcript.scrollTop).toBe(2000);
  await import("@testing-library/react").then(({ act }) =>
    act(() => finish({ truncated: false })),
  );
});
it("stops saving a stale copy when another tab changes it", async () => {
  setup();
  await ready();
  await send("Saved request");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "New chat" })).toBeEnabled(),
  );
  expect(screen.queryByLabelText("Saved on device")).not.toBeInTheDocument();
  const key = Object.keys(localStorage).find((key) =>
    key.startsWith("local-writer-chat-v1:"),
  )!;
  localStorage.removeItem(key);
  fireEvent(window, new StorageEvent("storage", { key, newValue: null }));
  expect(
    screen.getByRole("button", { name: "Save on device" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem(key)).toBeNull();
});

it("keeps legacy retry metadata without exposing writing preference fields", async () => {
  const chat = newConversation("write");
  chat.title = "Legacy draft";
  chat.messages = [
    {
      id: "u",
      role: "user",
      content: "Acme might ship Friday.",
      mode: "write",
      terms: "Acme",
      instruction: "Be direct",
    },
    {
      id: "a",
      role: "assistant",
      content: "We might ship Friday.",
      state: "complete",
      mode: "write",
      terms: "Acme",
      instruction: "Be direct",
    },
  ];
  saveChat(chat);
  const writer = setup();
  await ready();
  fireEvent.click(
    screen.getByRole("button", { name: "Open chat: Legacy draft" }),
  );
  expect(screen.queryByLabelText("Protected terms")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Custom instruction")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(writer.generate).toHaveBeenCalledTimes(1));
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({ terms: "Acme", instruction: "Be direct" }),
    expect.any(Function),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit & resend" }));
  expect(screen.getByLabelText("Your text")).toHaveValue(
    "Acme might ship Friday.",
  );
  await send("Make this more direct: Acme might ship Friday.");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({ mode: "chat", terms: "", instruction: "" }),
    expect.any(Function),
  );
});

it.each(["new chat", "send", "newer file"])(
  "ignores stale attachment completion after %s",
  async (transition) => {
    setup();
    await ready();
    let resolve!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>((done) => {
      resolve = done;
    });
    const old = new File(["old"], "old.txt", { type: "text/plain" });
    Object.defineProperty(old, "arrayBuffer", { value: () => pending });
    const picker = screen.getByLabelText("Text file selection");
    fireEvent.change(picker, { target: { files: [old] } });
    if (transition === "new chat")
      fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    if (transition === "send") await send("Current message");
    if (transition === "newer file") {
      const next = new File(["new"], "new.txt", { type: "text/plain" });
      Object.defineProperty(next, "arrayBuffer", {
        value: async () => new TextEncoder().encode("new").buffer,
      });
      fireEvent.change(picker, { target: { files: [next] } });
      await screen.findByLabelText("Remove new.txt");
    }
    await act(async () => {
      resolve(new TextEncoder().encode("old").buffer);
      await pending;
    });
    expect(screen.queryByLabelText("Remove old.txt")).not.toBeInTheDocument();
    if (transition === "newer file")
      expect(screen.getByLabelText("Remove new.txt")).toBeInTheDocument();
  },
);

it("shows reply progress until generation completes", async () => {
  const writer = setup();
  let finish!: () => void;
  let emit!: (text: string) => void;
  vi.mocked(writer.generate).mockImplementation(async (_request, chunk) => {
    emit = chunk;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return { truncated: false };
  });
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "Hello" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByText("Thinking…")).toBeVisible();
  expect(
    screen.getByText("Thinking…").closest('[role="status"]'),
  ).toHaveAttribute("aria-atomic", "true");
  act(() => emit("Hello there"));
  expect(await screen.findByText("Responding…")).toBeVisible();
  expect(screen.getByText("Hello there")).toBeVisible();
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.queryByText("Responding…")).not.toBeInTheDocument(),
  );
});

it("respects disabling automatic model loading", async () => {
  localStorage.setItem("local-writer-auto-load", "false");
  const writer = setup(true, true);
  fireEvent.click(screen.getByLabelText("Models"));
  await screen.findByRole("button", { name: "Load from device" });
  expect(writer.load).not.toHaveBeenCalled();
});
it("does not auto-download missing models", async () => {
  const writer = setup(true, false);
  fireEvent.click(screen.getByLabelText("Models"));
  await screen.findByRole("button", { name: "Download model" });
  expect(writer.load).not.toHaveBeenCalled();
});

it("does not store empty chats and warns when automatic saving fails", async () => {
  setup();
  await ready();
  expect(
    Object.keys(localStorage).filter((key) =>
      key.startsWith("local-writer-chat-v1:"),
    ),
  ).toHaveLength(0);
  const original = Storage.prototype.setItem;
  const storage = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("local-writer-chat-v1:"))
        throw new DOMException("Full", "QuotaExceededError");
      original.call(this, key, value);
    });
  try {
    await send("Keep this despite full storage");
    expect(
      await screen.findByText(
        "Could not save this chat in browser storage. Export it to keep your messages.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("We might ship Friday.")).toBeInTheDocument();
  } finally {
    storage.mockRestore();
  }
});

it("generates a title only from the first message and saves it with the conversation", async () => {
  const writer = setup();
  writer.title = vi.fn().mockResolvedValue("Weekend trip planning");
  await ready();
  await send("Can you help me plan a weekend trip?");
  expect(
    await screen.findByRole("button", {
      name: "Open chat: Weekend trip planning",
    }),
  ).toBeInTheDocument();
  expect(writer.title).toHaveBeenCalledWith(
    "Can you help me plan a weekend trip?",
  );
  await send("What about the budget?");
  expect(writer.title).toHaveBeenCalledTimes(1);
  cleanup();
  setup();
  expect(
    screen.getByRole("button", { name: "Open chat: Weekend trip planning" }),
  ).toBeInTheDocument();
});

it("keeps the reply and fallback title if title generation fails", async () => {
  const writer = setup();
  writer.title = vi.fn().mockRejectedValue(new Error("Title failed"));
  await ready();
  await send("A question");
  expect(
    await screen.findByText(
      "Could not generate a chat title. Keeping the first-message title.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("We might ship Friday.")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open chat: A question" }),
  ).toBeInTheDocument();
});

it("does not apply a late title after stopping", async () => {
  const writer = setup();
  let finish!: (value: string) => void;
  writer.title = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  await ready();
  await send("Keep original title");
  await waitFor(() => expect(writer.title).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  await act(async () => finish("Late title"));
  expect(
    screen.getByRole("button", { name: "Open chat: Keep original title" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Open chat: Late title" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("We might ship Friday.")).toBeInTheDocument();
});
