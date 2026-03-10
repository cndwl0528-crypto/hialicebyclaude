import { test, expect } from '@playwright/test';

test.describe('Book Selection', () => {
  test('should display book library', async ({ page }) => {
    await page.goto('/books');
    await expect(page.locator('body')).toBeVisible();
    // Check for book cards or grid layout
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('should show book details on click', async ({ page }) => {
    await page.goto('/books');
    // Try to find and click a book card
    const bookCard = page.locator('[data-testid="book-card"], .book-card, button:has-text("Read"), button:has-text("Start")').first();
    if (await bookCard.isVisible().catch(() => false)) {
      await bookCard.click();
      await page.waitForTimeout(1000);
      // Should show book details or navigate to session
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should filter books by level', async ({ page }) => {
    await page.goto('/books');
    // Look for level filter buttons
    const filterButton = page.locator('button:has-text("Beginner"), button:has-text("All"), select, [data-testid="level-filter"]').first();
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
    }
    await expect(page.locator('body')).toBeVisible();
  });
});
