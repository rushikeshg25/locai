import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const cases = JSON.parse(
  readFileSync(
    new URL("../docs/evaluation-cases.json", import.meta.url),
    "utf8",
  ),
) as { id: string; action: string; text: string; review: string }[];
const labels: Record<string, string> = {
  grammar: "Fix grammar",
  casual: "Make casual",
  professional: "Make professional",
  shorten: "Shorten",
  summarize: "Summarize",
  format: "Format",
};
test("collect real browser-model outputs for human quality review", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.RUN_EVAL !== "1",
    "Opt-in real-model evaluation; downloads weights and needs WebGPU.",
  );
  test.setTimeout(30 * 60 * 1000);
  const size = process.env.EVAL_MODEL === "large" ? "Larger" : "Small";
  const results: unknown[] = [];
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: new RegExp(size) }).check();
  const started = Date.now();
  await page.getByRole("button", { name: "Download model" }).click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached({ timeout: 600000 });
  const loadMs = Date.now() - started;
  try {
    for (const sample of cases) {
      await page.getByRole("button", { name: "New chat" }).click();
      await page.getByRole("button", { name: "Write", exact: true }).click();
      await page.getByLabel("Writing tools", { exact: true }).click();
      if (labels[sample.action])
        await page
          .getByRole("button", { name: labels[sample.action], exact: true })
          .click();
      else
        await page
          .getByLabel("More writing actions")
          .selectOption(sample.action);
      await page.getByLabel("Your text").fill(sample.text);
      const begin = Date.now();
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.locator(".assistant .markdown")).not.toBeEmpty({
        timeout: 120000,
      });
      const firstTextMs = Date.now() - begin;
      await expect(
        page.getByRole("button", { name: "Stop", exact: true }),
      ).toHaveCount(0, { timeout: 120000 });
      await expect(
        page.getByText(/Response failed|Stopped · incomplete/),
      ).toHaveCount(0);
      results.push({
        ...sample,
        output: await page.locator(".assistant .markdown").innerText(),
        firstTextMs,
        totalMs: Date.now() - begin,
        reviewStatus: "unreviewed",
      });
    }
  } finally {
    await testInfo.attach(`quality-${size.toLowerCase()}.json`, {
      body: JSON.stringify(
        {
          model: size,
          userAgent: await page.evaluate(() => navigator.userAgent),
          loadMs,
          results,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
});
