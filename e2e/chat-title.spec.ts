import { test, expect } from "@playwright/test";
import { installBrowserModel } from "./browser-model";
test("generated first-message title appears in history and persists on reload", async ({
  page,
}) => {
  await installBrowserModel(
    page,
    0,
    ["Here is a plan."],
    0,
    "Weekend trip planning",
  );
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  await page
    .getByLabel("Your text")
    .fill("Can you help me plan a weekend trip?");
  await page.getByLabel("Your text").press("Enter");
  await expect(
    page.getByRole("button", { name: "Open chat: Weekend trip planning" }),
  ).toBeEnabled();
  await expect(page.locator(".assistant .markdown")).toHaveText(
    "Here is a plan.",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open chat: Weekend trip planning" }),
  ).toBeVisible();
  await expect(page.locator(".assistant .markdown")).toHaveText(
    "Here is a plan.",
  );
});
