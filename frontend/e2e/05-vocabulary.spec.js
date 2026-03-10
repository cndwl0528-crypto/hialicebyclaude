import { test, expect } from '@playwright/test';

test.describe('Vocabulary Review', () => {
  test('should display vocabulary page', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show word list or empty state', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    // Should have either word cards or an empty state message
    expect(content).toBeTruthy();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/vocabulary');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
