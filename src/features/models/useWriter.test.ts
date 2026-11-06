import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWriter } from "./useWriter";
import type { Writer } from "./inference";
const request = {
  text: "hello",
  action: "grammar" as const,
  terms: "",
  instruction: "",
};
function fake(): Writer {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockResolvedValue({ truncated: false }),
    dispose: vi.fn(),
    cached: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("inference lifecycle", () => {
  it("ignores late output after cancellation and a new request", async () => {
    const writer = fake();
    let emit!: (text: string) => void;
    let finish!: (result: { truncated: boolean }) => void;
    vi.mocked(writer.generate).mockImplementationOnce((_request, chunk) => {
      emit = chunk;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useWriter(writer));
    await act(() => result.current.load("model"));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.run(request);
    });
    act(() => emit("partial"));
    expect(result.current.output).toBe("partial");
    act(() => result.current.stop());
    await act(() => result.current.load("model"));
    await act(() => result.current.run(request));
    await act(async () => {
      emit("stale");
      finish({ truncated: false });
      await pending;
    });
    expect(result.current.output).toBe("");
    expect(result.current.status).toBe("ready");
  });
  it("ignores progress and completion after cancelling a download", async () => {
    const writer = fake();
    let progress!: (n: number, s: string) => void;
    let finish!: () => void;
    vi.mocked(writer.load).mockImplementation((_model, callback) => {
      progress = callback;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useWriter(writer));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.load("model");
    });
    act(() => result.current.stop());
    await act(async () => {
      progress(1, "late");
      finish();
      await pending;
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.progress.message).not.toBe("late");
  });
  it("reports a generation error and unloads the engine", async () => {
    const writer = fake();
    vi.mocked(writer.generate).mockRejectedValue(new Error("GPU lost"));
    const { result } = renderHook(() => useWriter(writer));
    await act(() => result.current.load("model"));
    await act(() => result.current.run(request));
    expect(result.current.error).toMatch(/original text is preserved/);
    expect(result.current.status).toBe("idle");
    expect(writer.dispose).toHaveBeenCalled();
  });
  it("times out a stuck generation", async () => {
    vi.useFakeTimers();
    const writer = fake();
    vi.mocked(writer.generate).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useWriter(writer));
    await act(() => result.current.load("model"));
    act(() => {
      void result.current.run(request);
    });
    act(() => vi.advanceTimersByTime(120_000));
    expect(result.current.status).toBe("idle");
    expect(result.current.notice).toMatch(/timed out/);
  });
  it("reports truncation and cache deletion failures", async () => {
    const writer = fake();
    vi.mocked(writer.generate).mockResolvedValue({ truncated: true });
    vi.mocked(writer.remove).mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useWriter(writer));
    await act(() => result.current.load("model"));
    await act(() => result.current.run(request));
    expect(result.current.notice).toMatch(/incomplete/);
    await act(() => result.current.remove("model"));
    await waitFor(() => expect(result.current.error).toMatch(/site’s storage/));
  });
});
it("allows slow initialization but stops after ten minutes", async () => {
  vi.useFakeTimers();
  const writer = fake();
  vi.mocked(writer.load).mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useWriter(writer));
  act(() => {
    void result.current.load("model");
  });
  act(() => vi.advanceTimersByTime(240_000));
  expect(result.current.status).toBe("loading");
  act(() => vi.advanceTimersByTime(360_000));
  expect(result.current.status).toBe("idle");
  expect(result.current.notice).toMatch(/Loading timed out/);
  expect(writer.dispose).toHaveBeenCalled();
});
it("shows the runtime loading error", async () => {
  const writer = fake();
  vi.mocked(writer.load).mockRejectedValue(new Error("Failed to fetch"));
  const { result } = renderHook(() => useWriter(writer));
  await act(() => result.current.load("model"));
  expect(result.current.error).toContain("Failed to fetch");
});

it("interrupts generation without unloading the model and keeps partial output", async () => {
  const writer = fake();
  let finish!: () => void;
  writer.interrupt = vi.fn(() => finish());
  vi.mocked(writer.generate).mockImplementation(async (_request, emit) => {
    emit("Partial");
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return { truncated: false };
  });
  const { result } = renderHook(() => useWriter(writer));
  await act(() => result.current.load("model"));
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.run(request);
  });
  await act(async () => {
    result.current.stop();
    await pending;
  });
  expect(writer.interrupt).toHaveBeenCalledOnce();
  expect(writer.dispose).not.toHaveBeenCalled();
  expect(result.current.status).toBe("ready");
  expect(result.current.output).toBe("Partial");
});

it.each(["GPU device lost", { message: "Failed to fetch runtime" }])(
  "preserves serialized worker loading errors: %j",
  async (error) => {
    const writer = fake();
    vi.mocked(writer.load).mockRejectedValue(error);
    const { result } = renderHook(() => useWriter(writer));
    await act(() => result.current.load("model"));
    expect(result.current.error).toContain(
      typeof error === "string" ? error : error.message,
    );
    expect(result.current.status).toBe("idle");
  },
);
