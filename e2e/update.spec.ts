import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
test("service worker updates without closing tabs or losing drafts", async ({
  page,
}) => {
  let version = 1;
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    const path = resolve(
      root,
      "." +
        new URL(req.url!, "http://localhost").pathname.replace(
          /\/$/,
          "/index.html",
        ),
    );
    if (!path.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Type",
        (
          {
            ".js": "text/javascript",
            ".html": "text/html",
            ".css": "text/css",
          } as Record<string, string>
        )[extname(path)] ?? "application/octet-stream",
      );
      res.end(
        path.endsWith("/sw.js")
          ? body
              .toString()
              .replace(
                /(url:"index.html",revision:")[^"]+/,
                `$1release-${version}`,
              )
          : path.endsWith("/index.html")
            ? body
                .toString()
                .replace(
                  "</head>",
                  `<meta name="test-release" content="${version}"></head>`,
                )
            : body,
      );
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const address = server.address() as { port: number };
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.getByLabel("Your text").fill("Keep my draft");
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "1",
    );
    version = 2;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      (window as any).oldWorker = reg.active;
      await reg.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.ready).active !==
            (window as any).oldWorker,
        ),
      )
      .toBe(true);
    await expect(page.getByLabel("Your text")).toHaveValue("Keep my draft");
    await page.reload();
    await expect(page.getByLabel("Your text")).toBeVisible();
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "2",
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
