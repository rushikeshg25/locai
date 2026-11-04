import { test, expect, type Page } from "@playwright/test";
async function connect(page: Page) {
  await page.route("http://localhost:11434/v1/models", (route) =>
    route.fulfill({ json: { data: [{ id: "test-model" }] } }),
  );
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("button", { name: "Local server", exact: true }).click();
  await page.getByRole("button", { name: "Find installed models" }).click();
  await page
    .getByRole("button", { name: "Connect server", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Server connected", includeHidden: true }),
  ).toBeAttached();
}
test("chat context, Markdown, attachments, branching and opt-in persistence", async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route("http://localhost:11434/v1/chat/completions", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({
          choices: [
            {
              delta: {
                content:
                  "**Hello**\n\n```js\nconst answer = 42;\n```\n\n![image](https://example.com/track)",
              },
            },
          ],
        }) +
        "\n\ndata: [DONE]\n\n",
    });
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
  const second = requests[1] as { messages: { content: string }[] };
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
  await page.getByLabel("Conversation", { exact: true }).selectOption(saved!);
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
