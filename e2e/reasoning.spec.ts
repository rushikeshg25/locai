import { test, expect } from "@playwright/test";
import { installBrowserModel, modelRequests } from "./browser-model";
test("reasoning streams separately, persists, and stays out of later context", async ({
  page,
}) => {
  await installBrowserModel(
    page,
    0,
    ["<thi", "nk>Check the arithmetic.", "</thi", "nk>\nThe answer is 42."],
    150,
  );
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Reasoning/ })).toHaveCount(
    0,
  );
  await page.getByRole("radio", { name: /Qwen 3 0.6B/ }).check();
  await expect(page.getByRole("checkbox", { name: /Reasoning/ })).toBeChecked();
  await page.getByRole("button", { name: "Download model" }).click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("What is six times seven?");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".reasoning-block summary")).toHaveText(
    "Thinking…",
  );
  await expect(page.locator(".assistant .markdown")).toHaveText(
    "The answer is 42.",
  );
  await expect(page.locator(".reasoning-block summary")).toHaveText("Thinking");
  expect((await modelRequests(page))[0].extra_body).toEqual({
    enable_thinking: true,
  });
  await page.locator(".reasoning-block summary").click();
  await expect(page.locator(".reasoning-text")).toContainText(
    "Check the arithmetic.",
  );
  await page.getByLabel("Your text").fill("And what was the answer?");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toHaveCount(2);
  const second = (await modelRequests(page))[1];
  expect(second.messages[2].content).toBe("The answer is 42.");
  expect(JSON.stringify(second.messages)).not.toContain("Check the arithmetic");
  await page.getByLabel("Chat options").click();
  await page.getByRole("button", { name: "Save on device" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open chat: What is six times seven?" })
    .click();
  await expect(page.locator(".reasoning-block")).toHaveCount(2);
  await page.locator(".reasoning-block summary").first().click();
  await expect(page.locator(".reasoning-text").first()).toHaveText(
    "Check the arithmetic.",
  );
});
test("reasoning can be disabled and writing always uses non-thinking generation", async ({
  page,
}) => {
  await installBrowserModel(page, 0, ["<think>\n\n</think>\nAnswer"]);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 3 0.6B/ }).check();
  await page.getByRole("checkbox", { name: /Reasoning/ }).uncheck();
  await page.getByRole("button", { name: "Download model" }).click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("Say hello");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toHaveText("Answer");
  await expect(page.locator(".reasoning-block")).toHaveCount(0);
  expect((await modelRequests(page))[0].extra_body).toEqual({
    enable_thinking: false,
  });
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Reasoning/ }).check();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(async () => (await modelRequests(page)).length).toBe(2);
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeVisible();
  expect((await modelRequests(page))[1].extra_body).toEqual({
    enable_thinking: false,
  });
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page.getByLabel("Models", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Reasoning/ }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByLabel("Your text").fill("Fix this sentence.");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.locator(".assistant .markdown")).toHaveCount(2);
  expect((await modelRequests(page))[2].extra_body).toEqual({
    enable_thinking: false,
  });
});

test("unfinished reasoning is never presented as a final answer", async ({
  page,
}) => {
  await installBrowserModel(page, 0, ["<think>Still considering the problem."]);
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByRole("radio", { name: /Qwen 3 0.6B/ }).check();
  await page.getByRole("button", { name: "Download model" }).click();
  await expect(
    page.getByRole("button", { name: "Model ready", includeHidden: true }),
  ).toBeAttached();
  await page.getByLabel("Your text").fill("A difficult question");
  await page.getByLabel("Your text").press("Enter");
  await expect(page.getByText(/No final answer was produced/)).toBeVisible();
  await expect(page.locator(".assistant .markdown")).toHaveCount(0);
  await expect(page.locator(".reasoning-block summary")).toHaveText(
    "Thinking interrupted",
  );
});
