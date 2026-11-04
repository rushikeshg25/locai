import { test, expect } from '@playwright/test';
test('loads desktop and mobile without overflow or model download', async ({ page }) => {
  const external: string[] = []; const errors: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Find the right words.' })).toBeVisible();
  await page.getByLabel('Your text').fill('Private draft. We might ship Friday.');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Your text')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByText('Make it yours').click(); await page.getByLabel('Protected terms').fill('Acme');
  await expect(page.getByRole('button', { name: 'Fix grammar →' })).toBeDisabled();
  expect(external).toEqual([]); expect(errors).toEqual([]);
});
test('reloads the cached app offline without retaining drafts', async ({ page, context }) => {
  await page.goto('/'); await page.getByLabel('Your text').fill('DO NOT PERSIST THIS');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await expect(page.getByLabel('Your text')).toHaveValue('');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Find the right words.' })).toBeVisible();
  await page.getByLabel('Your text').fill('Offline draft'); await expect(page.getByLabel('Your text')).toHaveValue('Offline draft');
});
