import { test, expect } from "@playwright/test";
import { installBrowserModel } from "./browser-model";

for (const width of [1440, 390]) {
  test(`cite selected message text preserves draft at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await installBrowserModel(page, 0, ["A useful answer."]);
    await page.goto("/");
    await page.getByLabel("Models", { exact: true }).click();
    await page.getByRole("button", { name: "Download model" }).click();
    await expect(
      page.getByRole("button", { name: "Model ready", includeHidden: true }),
    ).toBeAttached();
    const input = page.getByLabel("Your text");
    await input.fill("Tell me something");
    await input.press("Enter");
    const answer = page.locator(".assistant .markdown p");
    await expect(answer).toHaveText("A useful answer.");
    await expect(
      page.getByRole("button", { name: "Edit result", exact: true }),
    ).toHaveCount(0);
    await input.fill("Explain this:");
    const select = async () =>
      answer.evaluate((el) => {
        const range = document.createRange();
        range.setStart(el.firstChild!, 2);
        range.setEnd(el.firstChild!, 15);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await select();
    const cite = page.getByRole("button", { name: "Cite", exact: true });
    await expect(cite).toBeVisible();
    const bounds = await cite.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Tab");
    await expect(cite).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("Explain this:\n\n> useful answer\n\n");
    await expect(input).toBeFocused();
    await expect(cite).toHaveCount(0);
    await select();
    await expect(cite).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cite).toHaveCount(0);
    await select();
    await cite.click();
    await expect(input).toHaveValue(/> useful answer\n\n\n\n> useful answer/);
  });
}
