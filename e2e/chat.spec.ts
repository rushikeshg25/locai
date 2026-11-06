import { test, expect, type Page } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";
async function connect(page: Page) {
  await installBrowserModel(page);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("button", { name: "Download model" }).click();
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
    page.getByRole("navigation", { name: "Conversations" }).getByRole("button"),
  ).toHaveCount(2);
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  await page.getByLabel("Chat options").click();
  await page.getByRole("button", { name: "Save on device" }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("button"),
  ).toHaveCount(2);
  await page
    .getByRole("navigation", { name: "Conversations" })
    .getByRole("button")
    .last()
    .click();
  await expect(page.locator(".assistant")).toHaveCount(2);
  await page.getByLabel("Chat options").click();
  await page.getByRole("button", { name: "Make temporary" }).click();
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("button"),
  ).toHaveCount(1);
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

test("chat drawer and options dismiss with backdrop and Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Chat options").click();
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Your text").click();
  await expect(page.locator(".chat-menu")).not.toHaveAttribute("open");
  await page.getByLabel("Chat options").click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Chat options")).toBeFocused();
  await page.screenshot({ path: "/tmp/writer-clean-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open chats", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Chat history" }),
  ).toBeVisible();
  await page.getByLabel("Search conversations").fill("no match");
  await expect(page.getByText("No matching conversations.")).toBeVisible();
  await page.getByLabel("Search conversations").fill("");
  await page.screenshot({ path: "/tmp/writer-clean-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open chats", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open chats", exact: true }).click();
  await page.mouse.click(375, 400);
  await expect(page.getByRole("dialog", { name: "Chat history" })).toBeHidden();
});
test("composer scrollbar appears only after its height limit", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Your text");
  await input.fill("A short draft ".repeat(20));
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() => input.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeLessThanOrEqual(1);
  await expect(input).toHaveCSS("overflow-y", "hidden");
  await input.fill("Line\n".repeat(40));
  await expect(input).toHaveCSS("overflow-y", "auto");
  expect(await input.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await input.fill("Short again");
  await expect(input).toHaveCSS("overflow-y", "hidden");
});
test("sending without a model keeps the draft and offers model setup", async ({
  page,
}) => {
  await installBrowserModel(page);
  await page.goto("/");
  const input = page.getByLabel("Your text");
  await input.fill("Keep this draft");
  const before = await input.boundingBox();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Load a model before sending" }),
  ).toBeVisible();
  await expect(input).toHaveValue("Keep this draft");
  expect((await input.boundingBox())!.y).toBe(before!.y);

  await expect(page.locator(".model-settings")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Download model" }).click();
  await expect(page.getByText("Load a model before sending")).toHaveCount(0);
  await expect(input).toHaveValue("Keep this draft");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".assistant")).toHaveCount(1);
});

test("model loading stays in its dropdown without moving the composer", async ({
  page,
}) => {
  await installBrowserModel(page, 2000);
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const input = page.getByLabel("Your text");
    const before = await input.boundingBox();
    await page.getByLabel("Models", { exact: true }).click();
    await page.getByRole("button", { name: "Download model" }).click();
    await expect(
      page.locator(".model-panel").getByRole("progressbar"),
    ).toBeVisible();
    expect((await input.boundingBox())!.y).toBe(before!.y);
    await expect(
      page.getByRole("button", { name: "Model ready", includeHidden: true }),
    ).toBeAttached();
    expect((await input.boundingBox())!.y).toBe(before!.y);
    await page.getByLabel("Models", { exact: true }).click();
    await page.getByRole("button", { name: "Unload", exact: true }).click();
    await page.keyboard.press("Escape");
  }
});

test("collapsed desktop sidebar keeps chat and search actions available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse chats" }).click();
  const rail = page.getByRole("complementary", { name: "Chat navigation" });
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS("width", "56px");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(rail).toBeVisible();
  await page.getByRole("button", { name: "Search chats", exact: true }).click();
  await expect(page.getByLabel("Search conversations")).toBeFocused();
  await page.getByRole("button", { name: "Collapse chats" }).click();
  await page.screenshot({ path: "/tmp/chat-rail-desktop.png" });
  await page.getByRole("button", { name: "Expand chats" }).click();
  await expect(page.getByLabel("Search conversations")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rail).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open chats" })).toBeVisible();
});

test("Chat and Write keep the composer fixed while writing tools overlay", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    const input = page.getByLabel("Your text");
    await input.fill("Keep my draft");
    const before = await input.boundingBox();
    await page.getByRole("button", { name: "Write", exact: true }).click();
    expect(await input.boundingBox()).toEqual(before);
    await page.getByLabel("Writing tools", { exact: true }).click();
    await page
      .getByText("Writing preferences · optional", { exact: true })
      .click();
    await expect(page.getByLabel("Protected terms")).toBeInViewport();
    expect(await input.boundingBox()).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(
      page.getByLabel("Writing tools", { exact: true }),
    ).toBeFocused();
    await page.getByLabel("Writing tools", { exact: true }).click();
    await input.click();
    await expect(page.locator(".writing-tools")).not.toHaveAttribute("open");
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    expect(await input.boundingBox()).toEqual(before);
    await expect(input).toHaveValue("Keep my draft");
  }
});
