// Render every raster icon from the checked-in SVG. Requires Playwright Chromium
// (npx playwright install chromium), or ICON_BROWSER_CHANNEL=chrome.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const svg = await readFile(
  new URL("../public/icons/locai.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  ...(process.env.ICON_BROWSER_CHANNEL
    ? { channel: process.env.ICON_BROWSER_CHANNEL }
    : {}),
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [32, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({
      path: new URL(`../public/icons/locai-${size}.png`, import.meta.url)
        .pathname,
      omitBackground: true,
    });
  }
  await page.setContent(
    `<style>html,body{margin:0;background:#252039}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
  );
  await page.screenshot({
    path: new URL("../public/icons/locai-maskable-512.png", import.meta.url)
      .pathname,
  });
} finally {
  await browser.close();
}
