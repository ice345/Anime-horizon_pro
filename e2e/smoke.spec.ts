import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://graphql.anilist.co', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { Page: { media: [] } } }),
    });
  });
});

test('loads the app shell and supports direct archive navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('ANIME')).toBeVisible();
  await page.goto('/archive');
  await expect(page.getByRole('heading', { name: '我的动画年鉴' })).toBeVisible();
});
