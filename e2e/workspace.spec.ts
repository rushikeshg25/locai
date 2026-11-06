import { test, expect } from "@playwright/test";
test("loads desktop and mobile without overflow or model download", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (
      !request
        .url()
        .startsWith(`http://127.0.0.1:${process.env.E2E_PORT ?? 4175}`)
    )
      external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Local Writer" }),
  ).toBeVisible();
  await page
    .getByLabel("Your text")
    .fill("Private draft. We might ship Friday.");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel("Your text")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page
    .getByText("Writing preferences · optional", { exact: true })
    .click();
  await page.getByLabel("Protected terms").fill("Acme");
  await page.getByLabel("Custom instruction").fill("Be direct");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel("Protected terms")).toBeInViewport();
    await expect(page.getByLabel("Custom instruction")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeEnabled();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("reloads the cached app offline without retaining drafts", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Your text").fill("DO NOT PERSIST THIS");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByLabel("Your text")).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Local Writer" }),
  ).toBeVisible();
  await page.getByLabel("Your text").fill("Offline draft");
  await expect(page.getByLabel("Your text")).toHaveValue("Offline draft");
});

test("model picker keeps selections open and dismisses outside or with Escape", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByLabel("Models", { exact: true });
  const picker = page.locator(".model-settings");
  await trigger.click();
  await page.getByRole("radio", { name: /Qwen 2.5 1.5B/ }).check();
  await expect(picker).toHaveAttribute("open", "");
  await page.getByRole("heading", { name: "Local Writer" }).click();
  await expect(picker).not.toHaveAttribute("open");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(picker).not.toHaveAttribute("open");
  await expect(trigger).toBeFocused();
});

test("expanded model catalog keeps actions separated and reachable", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel("Models", { exact: true }).click();
    await expect(page.getByRole("radio")).toHaveCount(6);
    await page.getByRole("radio", { name: /Phi 3.5 Mini/ }).check();
    await expect(
      page.getByRole("radio", { name: /Phi 3.5 Mini/ }),
    ).toBeChecked();
    const list = await page.locator(".model-catalog").boundingBox();
    const controls = await page.locator(".model-controls").boundingBox();
    expect(controls!.y - (list!.y + list!.height)).toBeGreaterThanOrEqual(16);
    await expect(
      page.getByRole("button", { name: "Delete downloaded model" }),
    ).toBeInViewport();
    await page.screenshot({ path: `/tmp/model-picker-${width}.png` });
    await page.keyboard.press("Escape");
  }
});
