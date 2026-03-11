import { test, expect } from '@playwright/test';
import { setStudentSession, mockAllApiFallback } from './fixtures.js';

test.describe('Session Review / Completion', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await setStudentSession(page);
    // Navigate WITHOUT sessionId → page uses built-in MOCK_REVIEW (demo mode)
    await page.goto('/review');
  });

  test('displays book title on review page', async ({ page }) => {
    await expect(page.getByText('The Very Hungry Caterpillar').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows grammar score from session', async ({ page }) => {
    await expect(page.getByText('82').first()).toBeVisible({ timeout: 10_000 });
  });

  test('vocabulary section shows words from the session', async ({ page }) => {
    await expect(page.getByText('caterpillar').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigation buttons are available', async ({ page }) => {
    const linkOrButton = page.locator('a, button').filter({ hasText: /another book|books|profile|home/i });
    await expect(linkOrButton.first()).toBeVisible({ timeout: 10_000 });
  });
});
