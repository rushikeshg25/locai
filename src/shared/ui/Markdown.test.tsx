import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Markdown } from "./Markdown";
afterEach(cleanup);
it("links numbered citations to their matching retrieved source", () => {
  render(
    <Markdown
      text="A supported fact [1]. An unknown source [2]."
      sources={[{ url: "https://example.com/reference" }]}
    />,
  );
  expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
    "href",
    "https://example.com/reference",
  );
  expect(screen.queryByRole("link", { name: "2" })).toBeNull();
});

it("keeps retrieved citation targets even if the model supplies a different link", () => {
  render(
    <Markdown
      text="Fact [1](https://wrong.example/)."
      sources={[{ url: "https://example.com/reference" }]}
    />,
  );
  expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
    "href",
    "https://example.com/reference",
  );
});
