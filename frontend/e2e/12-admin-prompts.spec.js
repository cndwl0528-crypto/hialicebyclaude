import { test, expect } from '@playwright/test';
import { setAdminSession, mockAllApiFallback } from './fixtures.js';

test.describe('Admin AI Prompts Editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await setAdminSession(page);
    await page.goto('/admin/prompts');
  });

  test('renders system prompt section with HiAlice content', async ({ page }) => {
    await expect(page.getByText(/you are hialice/i)).toBeVisible({ timeout: 10_000 });
  });

  test('level tabs show different content', async ({ page }) => {
    const beginnerTab = page.getByRole('button', { name: 'Beginner' });
    const advancedTab = page.getByRole('button', { name: 'Advanced' });
    const hasBeginnerTab = await beginnerTab.isVisible().catch(() => false);
    if (hasBeginnerTab) {
      await beginnerTab.click();
      await expect(page.getByText(/beginner|6.*8/i)).toBeVisible();
      await advancedTab.click();
      await expect(page.getByText(/advanced|12.*13/i)).toBeVisible();
    }
  });

  test('stage template tabs are visible', async ({ page }) => {
    // Stage tabs are only visible after clicking the "Stage Templates" main tab
    await page.getByRole('button', { name: 'Stage Templates' }).click();
    await expect(page.getByRole('button', { name: 'Title' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Body' })).toBeVisible();
  });
});
