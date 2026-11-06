import { test, expect } from "@playwright/test";
import { installBrowserModel } from "./browser-model";

for (const width of [1440, 390]) {
  test(`user bubble excludes action padding and stays stable on hover at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await installBrowserModel(page);
    await page.goto("/");
    await page.getByLabel("Models", { exact: true }).click();
    await page.getByRole("button", { name: "Download model" }).click();
    await expect(
      page.getByRole("button", { name: "Model ready", includeHidden: true }),
    ).toBeAttached();
    await page.getByLabel("Your text").fill("Help me plan my day");
    await page.getByLabel("Your text").press("Enter");
    await expect(page.locator(".assistant .markdown")).toBeVisible();
    await page.mouse.move(0, 0);
    const message = page.locator(".message.user");
    const body = message.locator(".message-body");
    const text = message.locator(".user-text");
    const tools = message.locator(".message-tools");
    await expect(tools).toHaveCSS("opacity", "0");
    const before = await body.boundingBox();
    const content = await text.boundingBox();
    const actions = await tools.boundingBox();
    expect(
      before!.y + before!.height - content!.y - content!.height,
    ).toBeCloseTo(12, 0);
    expect(actions!.y).toBeGreaterThanOrEqual(before!.y + before!.height);
    expect(before!.x + before!.width).toBeLessThanOrEqual(width);
    const next = await page.locator(".message.assistant").boundingBox();
    await body.hover();
    await expect(tools).toHaveCSS("opacity", "1");
    expect(await body.boundingBox()).toEqual(before);
    expect(await page.locator(".message.assistant").boundingBox()).toEqual(
      next,
    );
    await page.mouse.move(0, 0);
    await tools.getByRole("button", { name: "Copy", exact: true }).focus();
    await expect(tools).toHaveCSS("opacity", "1");
  });
}
