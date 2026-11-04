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
  const load = page.getByRole("button", { name: "Download / load model" });
  await expect(load).toBeEnabled({ timeout: 15_000 });
  await load.click();
  await expect(page.getByRole("button", { name: "Model ready" })).toBeVisible({
    timeout: 480_000,
  });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page
    .getByLabel("Your text")
    .fill("We might delivers the PostgreSQL update on Friday.");
  await page.getByRole("button", { name: "Fix grammar →" }).click();
  await expect(page.getByLabel("Your result")).not.toHaveValue("", {
    timeout: 120_000,
  });
  await expect(page.getByRole("button", { name: "Copy result" })).toBeEnabled({
    timeout: 120_000,
  });
  expect(requests).toEqual([]);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await load.click();
  await expect(page.getByRole("button", { name: "Model ready" })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByLabel("Your text").fill("This are a short message.");
  await page.getByRole("button", { name: "Fix grammar →" }).click();
  await expect(page.getByLabel("Your result")).not.toHaveValue("", {
    timeout: 120_000,
  });
});
