import { test, expect } from "@playwright/test";
test("real model generates locally and reloads offline", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.RUN_MODEL !== "1",
    "Opt-in: downloads approximately 280 MB and requires WebGPU.",
  );
  test.setTimeout(600_000);
  await page.goto("/");
  const load = page.getByRole("button", { name: "Download model" });
  await page.getByLabel("Models", { exact: true }).click();
  await expect(load).toBeEnabled({ timeout: 15_000 });
  await load.click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached({
    timeout: 480_000,
  });
  await page.getByRole("button", { name: "Write", exact: true }).click();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page
    .getByLabel("Your text")
    .fill("We might delivers the PostgreSQL update on Friday.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".assistant .markdown")).not.toBeEmpty({
    timeout: 120_000,
  });
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toHaveCount(0, { timeout: 120000 });
  await expect(
    page.getByText(/Response failed|Stopped · incomplete/),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached({
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page.getByLabel("Your text").fill("This are a short message.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".assistant .markdown")).not.toBeEmpty({
    timeout: 120_000,
  });
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toHaveCount(0, { timeout: 120000 });
  await expect(
    page.getByText(/Response failed|Stopped · incomplete/),
  ).toHaveCount(0);
});
