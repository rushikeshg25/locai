import { test, expect } from "@playwright/test";

test("chat actions persist names and pins, and delete only the targeted chat", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("actions-seeded")) return;
    for (const [id, title] of [
      ["first", "First chat"],
      ["second", "Second chat"],
    ]) {
      localStorage.setItem(
        `local-writer-chat-v1:${id}`,
        JSON.stringify({
          id,
          title,
          saved: true,
          mode: "chat",
          updatedAt: id === "first" ? 2 : 1,
          messages: [{ id: `${id}-m`, role: "user", content: title }],
        }),
      );
    }
    localStorage.setItem("actions-seeded", "true");
  });
  await page.goto("/");
  const row = page.locator('[data-chat-id="second"]');
  const controls = row.locator(".chat-row-actions");
  await page.getByRole("heading", { name: "Locai" }).hover();
  await expect(controls).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(controls).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Options for Second chat" }).click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("textbox", { name: "Chat title" }).fill("Project notes");
  await page.getByRole("textbox", { name: "Chat title" }).press("Enter");
  await row.hover();
  await page
    .getByRole("button", { name: "Pin chat: Project notes", exact: true })
    .click();
  await expect(page.locator(".chat-row").first()).toHaveAttribute(
    "data-chat-id",
    "second",
  );
  await page.reload();
  await expect(page.locator(".chat-row").first()).toHaveAttribute(
    "data-chat-id",
    "second",
  );
  await expect(
    page.getByRole("button", { name: "Open chat: Project notes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open chat: First chat" }).click();
  await page.getByLabel("Your text").fill("Keep my draft");
  await row.hover();
  await page.getByRole("button", { name: "Options for Project notes" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Options for Project notes" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Locai" }).click();
  await expect(page.locator("#chat-row-menu")).toHaveCount(0);
  await row.hover();
  await page.getByRole("button", { name: "Options for Project notes" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete chat", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByLabel("Your text")).toHaveValue("Keep my draft");
  await page.reload();
  await expect(page.locator(".chat-row")).toHaveCount(1);
});

test("chat menu works in the mobile drawer without overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Open chats" }).click();
  await expect(page.locator(".chat-row-actions")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Options for New chat" }).click();
  await expect(
    page.getByRole("button", { name: "Rename", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Delete chat", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Chat history" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
