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
  await page.goto('/archive');
  await expect(page.getByText('ANIME')).toBeVisible();
  await expect(page.getByRole('heading', { name: '我的动画年鉴' })).toBeVisible();
});

test('closes a modal with Escape and restores focus to its trigger', async ({ page }) => {
  await page.goto('/');
  const searchButton = page.getByRole('button', { name: '搜索并收录任意动画' });
  await searchButton.click();

  const dialog = page.getByRole('dialog', { name: '从任意年份收录动画' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(searchButton).toBeFocused();
});
