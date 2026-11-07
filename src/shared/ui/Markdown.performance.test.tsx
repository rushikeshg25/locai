import { render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const parse = vi.hoisted(() => vi.fn());
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    parse(children);
    return <p>{children}</p>;
  },
}));
import { Markdown } from "./Markdown";
afterEach(() => {
  cleanup();
  parse.mockClear();
});
it("does not reparse unchanged responses when the parent rerenders", () => {
  const { rerender } = render(<Markdown text="Existing answer" />);
  for (let i = 0; i < 20; i++) rerender(<Markdown text="Existing answer" />);
  expect(parse).toHaveBeenCalledTimes(1);
  rerender(<Markdown text="Updated answer" />);
  expect(parse).toHaveBeenCalledTimes(2);
});
it("refreshes citation links when source props change", () => {
  const { rerender } = render(
    <Markdown text="Fact [1]" sources={[{ url: "https://example.com/a" }]} />,
  );
  rerender(
    <Markdown text="Fact [1]" sources={[{ url: "https://example.com/b" }]} />,
  );
  expect(parse).toHaveBeenLastCalledWith(
    expect.stringContaining("https://example.com/b"),
  );
});
