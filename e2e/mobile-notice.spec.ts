import { test, expect, devices } from "@playwright/test";
for (const device of ["iPhone 13", "Pixel 7"]) {
  test(`shows availability notice on ${device} without starting model downloads`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...devices[device] });
    const page = await context.newPage();
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (/huggingface|raw.githubusercontent/.test(request.url()))
        modelRequests.push(request.url());
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Locai isn’t available on mobile yet.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Local AI models need GPU support/),
    ).toBeVisible();
    await expect(page.getByLabel("Your text")).toHaveCount(0);
    await expect(page.getByLabel("Models", { exact: true })).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });
}
