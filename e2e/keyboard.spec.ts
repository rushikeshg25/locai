import { test, expect } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";
test("keyboard shortcuts insert newlines at the caret and send only on Enter", async ({
  page,
}) => {
  await installBrowserModel(page);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 2.5 0.5B/ }).click();
  await expect(
    page.getByText("Loaded in memory", { exact: true }),
  ).toBeAttached();
  const input = page.getByLabel("Your text");
  await expect(input).toHaveAccessibleDescription(/Enter to send/);
  await input.fill("FirstSecond");
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await input.press("Control+Enter");
  await expect(input).toHaveValue("First\nSecond");
  await input.press("End");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("First\nSecond\n");
  expect(await modelRequests(page)).toHaveLength(0);
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  expect(await modelRequests(page)).toHaveLength(0);
  await input.press("Enter");
  await expect(
    page.locator(".assistant strong").filter({ hasText: "Hello" }),
  ).toBeVisible();
  expect(await modelRequests(page)).toHaveLength(1);
});
