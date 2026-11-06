import { test, expect } from "@playwright/test";
import { installBrowserModel } from "./browser-model";
test("saved model detection survives reload and deleting a row removes only that model, not the selection", async ({
  page,
}) => {
  await installBrowserModel(page);
  await page.addInitScript(() =>
    localStorage.setItem("local-writer-auto-load", "false"),
  );
  await page.goto("/");
  const bases = ["0.5", "1.5"].map(
    (size) =>
      `https://huggingface.co/mlc-ai/Qwen2.5-${size}B-Instruct-q4f16_1-MLC/resolve/main/`,
  );
  await page.evaluate(async (bases) => {
    const cache = await caches.open("webllm/model");
    for (const base of bases) {
      await cache.put(
        base + "tensor-cache.json",
        new Response(JSON.stringify({ records: [{ dataPath: "params.bin" }] })),
      );
      await cache.put(base + "params.bin", new Response("fixture weights"));
    }
  }, bases);
  await page.reload();
  await page.getByLabel("Models", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load from device", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Downloaded on this device", { exact: true }),
  ).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete Qwen 2.5 0.5B" }).click();
  await expect(
    page.getByRole("button", { name: "Load from device", exact: true }),
  ).toBeEnabled();
  await page.getByRole("radio", { name: /Qwen 2.5 1.5B/ }).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Qwen 2.5 0.5B" }).click();
  await expect(
    page.getByRole("button", { name: "Load from device", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(async (bases) => {
      const cache = await caches.open("webllm/model");
      return Promise.all(
        bases.map(async (base) =>
          Boolean(await cache.match(base + "params.bin")),
        ),
      );
    }, bases),
  ).toEqual([false, true]);
  await page.reload();
  await page.getByLabel("Models", { exact: true }).click();
  await expect(
    page.getByText("Downloaded on this device", { exact: true }),
  ).toHaveCount(1);
});
