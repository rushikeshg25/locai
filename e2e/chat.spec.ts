import { test, expect, type Page } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";
async function connect(page: Page) {
  await installBrowserModel(page);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("button", { name: "Download / load model" }).click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached();
}
test("chat context, Markdown, attachments, branching and opt-in persistence", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1")
      external.push(request.url());
  });
  await connect(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("The meeting is Friday."),
  });
  await page.getByLabel("Your text").fill("Remember the meeting");
  await page.getByLabel("Your text").press("Enter");
  await expect(
    page.locator(".assistant strong").filter({ hasText: "Hello" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy code", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".markdown img")).toHaveCount(0);
  await page.getByLabel("Your text").fill("Which day?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".assistant")).toHaveCount(2);
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/local-writer-conversation.png" });
  const second = (await modelRequests(page))[1];
  expect(external).toEqual([]);
  expect(second.messages).toHaveLength(4);
  expect(second.messages[1].content).toContain("The meeting is Friday.");
  await page.getByRole("button", { name: "Retry", exact: true }).last().click();
  await expect(
    page.getByLabel("Conversation", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  await page.getByRole("button", { name: "Save on device" }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Conversation", { exact: true }).locator("option"),
  ).toHaveCount(2);
  const saved = await page
    .getByLabel("Conversation", { exact: true })
    .locator("option")
    .last()
    .getAttribute("value");
  await page.locator(`[data-chat-id="${saved}"]`).click();
  await expect(page.locator(".assistant")).toHaveCount(2);
  await page.getByRole("button", { name: "Make temporary" }).click();
  await page.reload();
  await expect(page.getByLabel("Conversation", { exact: true })).toHaveCount(0);
});
test("light/dark composer and narrow layout remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Write", exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      const toggle = page.getByRole("button", {
        name: `Switch to ${theme} mode`,
      });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "Send message" }),
      ).toBeInViewport();
      await page.screenshot({
        path: `/tmp/local-writer-${width}-${theme}.png`,
      });
    }
  }
});
test("auto-growing input handles newline and popup Escape", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Your text");
  const before = await input.boundingBox();
  await input.fill(Array.from({ length: 7 }, (_, i) => `line ${i}`).join("\n"));
  expect((await input.boundingBox())!.height).toBeGreaterThan(before!.height);
  await input.press("Shift+Enter");
  await expect(input).toHaveValue(/\n$/);
  await page.getByLabel("Models", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".model-settings")).not.toHaveAttribute("open");
});
