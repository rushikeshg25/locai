import { test, expect, type Page } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";
const results = {
  results: [
    {
      title: "WebGPU documentation",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      content: "WebGPU provides GPU computation in the browser.",
    },
  ],
};
async function connect(page: Page) {
  await installBrowserModel(page);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
}
test("optional search sends only current question and passes sources to local inference", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route("**/api/search?*", async (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q")!);
    await route.fulfill({ json: results });
  });
  await connect(page);
  await page.getByLabel("Your text").fill("Private earlier message");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  expect(queries).toEqual([]);
  await page
    .getByRole("button", { name: "Search the web", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("Private attachment"),
  });
  await page.getByLabel("Your text").fill("What is WebGPU?");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".web-sources summary")).toContainText("Sources");
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  expect(queries).toEqual(["What is WebGPU?"]);
  const request = (await modelRequests(page)).at(-1)!;
  expect(request.messages[0].content).toContain("untrusted");
  expect(request.messages.at(-1)!.content).toContain(
    "WebGPU provides GPU computation",
  );
  expect(request.messages.at(-1)!.content).toContain("Private attachment");
  await page.locator(".web-sources summary").click();
  await expect(
    page.getByRole("link", { name: "WebGPU documentation" }),
  ).toHaveAttribute("href", results.results[0].url);
});
test("failed search can retry and cancellation never starts generation", async ({
  page,
}) => {
  await connect(page);
  await page
    .getByRole("button", { name: "Search the web", exact: true })
    .click();
  await page.route("**/api/search?*", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.getByLabel("Your text").fill("Find a fact");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "Web search is unavailable",
  );
  expect(await modelRequests(page)).toHaveLength(0);
  await page.unroute("**/api/search?*");
  await page.route("**/api/search?*", () => {});
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Searching the web…")).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Search cancelled");
  expect(await modelRequests(page)).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeVisible();
});
test("search toggle fits the unified mobile composer", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(
      page.getByRole("button", { name: "Search the web", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByRole("button", { name: "Search the web", exact: true }),
  ).toBeVisible();
});
