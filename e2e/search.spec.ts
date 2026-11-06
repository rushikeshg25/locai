import { test, expect } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";

test("new messages have no web toggle and make no search requests", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/search")) requests.push(request.url());
  });
  await installBrowserModel(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Search the web" }),
  ).toHaveCount(0);
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("Tell me about WebGPU");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toBeVisible();
  expect(requests).toEqual([]);
});

test("saved sources remain readable but retry does not repeat retired search", async ({
  page,
}) => {
  await installBrowserModel(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "local-writer-chat-v1:legacy",
      JSON.stringify({
        id: "legacy",
        title: "Saved search",
        mode: "chat",
        updatedAt: 1,
        saved: true,
        messages: [
          {
            id: "u",
            role: "user",
            content: "What is WebGPU?",
            webSearch: true,
          },
          {
            id: "a",
            role: "assistant",
            content: "GPU computation [1].",
            state: "complete",
            webSearch: true,
            webSources: [
              {
                title: "Reference",
                url: "https://example.com/reference",
                snippet: "GPU computation",
              },
            ],
          },
        ],
      }),
    ),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/search")) requests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat: Saved search" }).click();
  await expect(
    page.getByRole("link", { name: "1", exact: true }),
  ).toHaveAttribute("href", "https://example.com/reference");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(async () => (await modelRequests(page)).length).toBe(1);
  expect(requests).toEqual([]);
  expect((await modelRequests(page))[0].messages.at(-1)?.content).toBe(
    "What is WebGPU?",
  );
});
