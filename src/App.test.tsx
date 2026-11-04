import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
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
  const load = screen.getByRole("button", { name: "Download / load model" });
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
  expect(
    screen.getByRole("button", { name: "Download / load model" }),
  ).toBeDisabled();
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
it("writes and reviews every action without including chat history", async () => {
  const writer = setup();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: /^Write$/ }));
  fireEvent.change(screen.getByLabelText("More writing actions"), {
    target: { value: "warmer" },
  });
  await send("Send the report.");
  expect(writer.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({ mode: "write", action: "warmer" }),
    expect.any(Function),
  );
  expect(screen.getByText("Review changes")).toBeInTheDocument();
});
it("preserves failed messages and forks a retry", async () => {
  const writer = setup();
  vi.mocked(writer.generate).mockRejectedValueOnce(new Error("lost device"));
  await ready();
  await send("My draft");
  await screen.findByText(/Generation failed/);
  expect(screen.getByText("My draft")).toBeInTheDocument();
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("We might ship Friday.");
  expect(
    screen.getByLabelText("Conversation").querySelectorAll("option"),
  ).toHaveLength(2);
});
it("edit and resend keeps the original branch", async () => {
  const writer = setup();
  await ready();
  await send("First");
  fireEvent.click(screen.getByRole("button", { name: "Edit & resend" }));
  await send("Changed");
  expect(
    screen.getByLabelText("Conversation").querySelectorAll("option"),
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
it("saves only after opt-in, restores saved history and can make it temporary", async () => {
  setup();
  await ready();
  await send("Keep this");
  expect(
    Object.keys(localStorage).filter((key) =>
      key.startsWith("local-writer-chat"),
    ),
  ).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Save on device" }));
  await screen.findByText("Saved on this device");
  cleanup();
  setup();
  const chooser = screen.getByLabelText("Conversation");
  const options = Array.from(chooser.querySelectorAll("option"));
  fireEvent.change(chooser, {
    target: {
      value: options.find((option) => option.textContent === "Keep this")!
        .value,
    },
  });
  expect(screen.getByText("We might ship Friday.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Make temporary" }));
  expect(
    Object.keys(localStorage).filter((key) =>
      key.startsWith("local-writer-chat"),
    ),
  ).toHaveLength(0);
});
it("turns selected draft text into a focused writing request", async () => {
  const writer = setup();
  await ready();
  const input = screen.getByLabelText("Your text") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Keep this. Fix these." } });
  input.setSelectionRange(11, 21);
  fireEvent.select(input);
  fireEvent.click(
    screen.getByRole("button", { name: "Rewrite selected text" }),
  );
  expect(input).toHaveValue("Fix these.");
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(writer.generate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "write", text: "Fix these." }),
      expect.any(Function),
    ),
  );
});
