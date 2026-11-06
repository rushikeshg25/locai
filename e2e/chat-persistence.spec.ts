import { test, expect } from "@playwright/test";
import { installBrowserModel } from "./browser-model";

test("chats save automatically, survive reopening, and can be deleted or temporary", async ({
  page,
  context,
}) => {
  await installBrowserModel(page, 0, ["Saved reply."]);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("Remember this conversation");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toHaveText("Saved reply.");
  const reopened = await context.newPage();
  await installBrowserModel(reopened);
  await reopened.goto("/");
  await expect(reopened.locator(".user-text")).toHaveText(
    "Remember this conversation",
  );
  await expect(reopened.locator(".assistant .markdown")).toHaveText(
    "Saved reply.",
  );
  await reopened.getByLabel("Chat options").click();
  reopened.on("dialog", (dialog) => dialog.accept());
  await reopened.getByRole("button", { name: "Delete", exact: true }).click();
  await reopened.reload();
  await expect(reopened.locator(".message")).toHaveCount(0);
  await reopened.getByLabel("Chat options").click();
  await reopened.getByRole("button", { name: "Make temporary" }).click();
  await reopened.keyboard.press("Escape");
  await reopened.getByLabel("Models", { exact: true }).click();
  await reopened.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    reopened.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await reopened.getByLabel("Your text").fill("Do not keep this");
  await reopened.getByLabel("Your text").press("Enter");
  await expect(reopened.locator(".assistant .markdown")).toBeVisible();
  await reopened.reload();
  await expect(reopened.locator(".message")).toHaveCount(0);
  await reopened.close();
});

test("refresh during generation restores the partial reply as stopped", async ({
  page,
}) => {
  await installBrowserModel(page, 0, ["Partial answer", " continuation"], 3000);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("A long answer please");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toHaveText(
    "Partial answer",
    { timeout: 15000 },
  );
  await page.reload();
  await expect(page.locator(".user-text")).toHaveText("A long answer please");
  await expect(page.locator(".assistant .markdown")).toHaveText(
    "Partial answer",
  );
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toHaveCount(0);
});
