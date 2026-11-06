import { expect, it } from "vitest";
import { cleanChatTitle } from "./chatTitle";
it("accepts concise titles and strips surrounding formatting", () => {
  expect(cleanChatTitle("Title: “Planning a weekend trip”")).toBe(
    "Planning a weekend trip",
  );
  expect(cleanChatTitle("東京の週末旅行")).toBe("東京の週末旅行");
});
it("rejects empty, multiline, reasoning, and overly long output", () => {
  for (const value of [
    "",
    "Title: ",
    "First\nExplanation",
    "<think>Reasoning</think>",
    "x".repeat(81),
  ])
    expect(cleanChatTitle(value)).toBeNull();
});
