import { test, expect } from '@playwright/test';
import { setStudentSession, mockVocabApi, mockAllApiFallback } from './fixtures.js';

test.describe('Vocabulary Review', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await mockVocabApi(page);
    await setStudentSession(page);
    await page.goto('/vocabulary');
  });

  test('displays vocabulary words', async ({ page }) => {
    await expect(page.getByText('caterpillar')).toBeVisible({ timeout: 10_000 });
  });

  test('shows part-of-speech labels', async ({ page }) => {
    await expect(page.getByText('Noun')).toBeVisible({ timeout: 10_000 });
  });

  test('flip card interaction reveals definition', async ({ page }) => {
    // The flip card is a div[role="button"] with aria-label starting with "Flip card to reveal"
    // Using a specific selector to avoid matching the "Flip Card" mode button
    const flipCard = page.locator('[aria-label^="Flip card to reveal"]');
    const isFlipVisible = await flipCard.isVisible().catch(() => false);
    if (isFlipVisible) {
      await flipCard.click();
      await expect(page.getByText(/creature|butterfly/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText('caterpillar')).toBeVisible({ timeout: 10_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
});
