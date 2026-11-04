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
afterEach(cleanup);
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
  const button = screen.getByRole("button", { name: "Download / load model" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByRole("button", { name: "Model ready" });
}
it("requires explicit model loading and disables unsupported devices", async () => {
  const writer = setup(false);
  expect(await screen.findByText(/WebGPU is unavailable/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Download / load model" }),
  ).toBeDisabled();
  expect(writer.load).not.toHaveBeenCalled();
});
it("runs an action, reviews changes, copies and undoes input replacement", async () => {
  const writer = setup();
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "We might ship Acme Friday" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar →" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Your result")).toHaveValue(
      "We might ship Friday.",
    ),
  );
  expect(writer.generate).toHaveBeenCalledWith(
    {
      text: "We might ship Acme Friday",
      action: "grammar",
      terms: "",
      instruction: "",
    },
    expect.any(Function),
  );
  expect(screen.getByText("Review grammar changes")).toBeInTheDocument();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy result" }));
  await screen.findByText("Copied.");
  expect(writeText).toHaveBeenCalledWith("We might ship Friday.");
  fireEvent.click(screen.getByRole("button", { name: "Use as input" }));
  expect(screen.getByLabelText("Your text")).toHaveValue(
    "We might ship Friday.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Undo input change" }));
  expect(screen.getByLabelText("Your text")).toHaveValue(
    "We might ship Acme Friday",
  );
});
it("preserves the draft on errors and makes retry possible", async () => {
  const writer = setup();
  vi.mocked(writer.generate).mockRejectedValue(new Error("lost device"));
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "My draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar →" }));
  expect(await screen.findByText(/Generation failed/)).toBeInTheDocument();
  expect(screen.getByLabelText("Your text")).toHaveValue("My draft");
  expect(
    screen.getByRole("button", { name: "Download / load model" }),
  ).toBeEnabled();
});
it("clears output and undo history and rejects overlong input", async () => {
  setup();
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "word ".repeat(501) },
  });
  expect(screen.getByRole("button", { name: "Fix grammar →" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByLabelText("Your text")).toHaveValue("");
  expect(screen.getByLabelText("Your result")).toHaveValue("");
  expect(
    screen.queryByText(/Cleared writing and unloaded/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Each message is a separate/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Make it yours/)).not.toBeInTheDocument();
});

it("keeps setup inside the picker and closes it after loading", async () => {
  setup();
  expect(screen.queryByText(/One-time setup/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Models"));
  await ready();
  await waitFor(() =>
    expect(screen.queryByText(/One-time setup/)).not.toBeInTheDocument(),
  );
  expect(
    screen.getByLabelText("Models").closest("details"),
  ).not.toHaveAttribute("open");
});
it("skips first-use setup when a model is already cached", async () => {
  const writer = setup(true, true);
  const load = await screen.findByRole("button", {
    name: "Load selected model",
  });
  expect(screen.queryByText(/One-time setup/)).not.toBeInTheDocument();
  expect(writer.load).not.toHaveBeenCalled();
  fireEvent.click(load);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Load selected model" }),
    ).not.toBeInTheDocument(),
  );
  expect(writer.load).toHaveBeenCalledOnce();
});

it("shows per-model cache status and preserves the draft when switching", async () => {
  const writer = setup();
  vi.mocked(writer.cached).mockImplementation(async (id) =>
    id.includes("1.5B"),
  );
  await ready();
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "Keep my draft" },
  });
  fireEvent.click(screen.getByLabelText("Models"));
  const larger = screen.getByRole("radio", { name: /Larger/ });
  await waitFor(() =>
    expect(larger.closest("label")).toHaveTextContent("Downloaded"),
  );
  fireEvent.click(larger);
  expect(screen.getByLabelText("Your text")).toHaveValue("Keep my draft");
  expect(writer.load).toHaveBeenCalledTimes(1);
  fireEvent.click(
    await screen.findByRole("button", { name: "Load selected model" }),
  );
  await waitFor(() =>
    expect(writer.load).toHaveBeenLastCalledWith(
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      expect.any(Function),
    ),
  );
});

it.each(["simplify", "expand", "direct", "warmer"])(
  "runs the extra %s action without changing the draft",
  async (action) => {
    const writer = setup();
    await ready();
    fireEvent.change(screen.getByLabelText("Your text"), {
      target: { value: "We may deliver on Friday." },
    });
    fireEvent.change(screen.getByLabelText("More writing actions"), {
      target: { value: action },
    });
    fireEvent.click(screen.getByRole("button", { name: /→$/ }));
    await waitFor(() =>
      expect(writer.generate).toHaveBeenCalledWith(
        expect.objectContaining({ action, text: "We may deliver on Friday." }),
        expect.any(Function),
      ),
    );
    expect(screen.getByLabelText("Your text")).toHaveValue(
      "We may deliver on Friday.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
    expect(screen.getByLabelText("More writing actions")).toHaveValue("");
  },
);
