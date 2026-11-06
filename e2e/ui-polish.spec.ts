import { test, expect } from "@playwright/test";

test("menus dismiss when keyboard focus leaves and close returns focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Models", { exact: true }).click();
  await page.getByLabel("Your text").focus();
  await expect(page.locator(".model-settings")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page.getByLabel("Writing tools", { exact: true }).click();
  await page.getByRole("button", { name: "Close writing tools" }).click();
  await expect(page.getByLabel("Writing tools", { exact: true })).toBeFocused();
  await page.getByLabel("Writing tools", { exact: true }).click();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".writing-tools")).not.toHaveAttribute("open");
  await page.getByLabel("Chat options").click();
  await page.getByLabel("Your text").focus();
  await expect(page.locator(".chat-menu")).not.toHaveAttribute("open");
});

test("panels, tooltips and composer fit small, landscape and desktop viewports", async ({
  page,
}) => {
  await page.goto("/");
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", {
        name: `Switch to ${theme} mode`,
      });
      if (await toggle.count()) await toggle.click();
      await page.getByLabel("Your text").fill("A draft that stays in place");
      const before = await page.getByLabel("Your text").boundingBox();
      await page.getByLabel("Models", { exact: true }).click();
      const panel = await page.locator(".model-panel").boundingBox();
      expect(panel!.x).toBeGreaterThanOrEqual(0);
      expect(panel!.y).toBeGreaterThanOrEqual(0);
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(height);
      await page.getByRole("button", { name: "Close models" }).click();
      await expect(page.getByLabel("Models", { exact: true })).toBeFocused();
      expect(await page.getByLabel("Your text").boundingBox()).toEqual(before);
      await page.getByRole("button", { name: "Attach text files" }).focus();
      const tip = await page.getByRole("tooltip").boundingBox();
      expect(tip!.y).toBeGreaterThanOrEqual(0);
      expect(tip!.y + tip!.height).toBeLessThanOrEqual(height);
      expect(tip!.x + tip!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      if (width <= 600) {
        for (const name of [
          "Chat",
          "Write",
          "Attach text files",
          "Search the web",
          "Send message",
        ]) {
          const box = await page
            .getByRole("button", { name, exact: true })
            .boundingBox();
          expect(box!.height, `${name} touch height`).toBeGreaterThanOrEqual(
            44,
          );
          expect(box!.width, `${name} touch width`).toBeGreaterThanOrEqual(44);
        }
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/locai-polished-${width}-${theme}.png`,
      });
    }
  }
});

test("keyboard skip link and reduced motion remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to message" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your text")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Write", exact: true }),
  ).toHaveCSS("transition-duration", "0s");
});

test("primary and muted text meet contrast targets in both themes", async ({
  page,
}) => {
  await page.goto("/");
  const lum = (hex: string) => {
    const rgb = hex.trim().replace("#", "");
    const expanded =
      rgb.length === 3 ? [...rgb].map((c) => c + c).join("") : rgb;
    const parts = [0, 2, 4]
      .map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
  };
  for (const theme of ["light", "dark"]) {
    await page
      .locator("html")
      .evaluate((el, t) => (el.dataset.theme = t), theme);
    const colors = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        ["--text", "--muted", "--bg", "--surface", "--soft"].map((k) => [
          k,
          s.getPropertyValue(k),
        ]),
      );
    });
    for (const fg of ["--text", "--muted"])
      for (const bg of ["--bg", "--surface", "--soft"]) {
        const a = lum(colors[fg]),
          b = lum(colors[bg]);
        expect(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          `${theme} ${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
  }
});
