import { test, expect } from '@playwright/test';
import { setStudentSession, mockBooksApi, mockSessionsApi, mockAllApiFallback } from './fixtures.js';

test.describe('Book Selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await mockBooksApi(page);
    await mockSessionsApi(page);
    await setStudentSession(page);
    await page.goto('/books');
  });

  test('renders book library with book titles', async ({ page }) => {
    // Student is Beginner, so click "All" to show all levels
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Charlotte's Web")).toBeVisible();
  });

  test('level filter buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Beginner' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Intermediate' })).toBeVisible();
  });

  test('search input filters books', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill('caterpillar');
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible();
  });

  test('book cards display author names', async ({ page }) => {
    // Student is Beginner — check beginner-level book author, then switch to All for Intermediate
    await expect(page.getByText('Eric Carle').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByText('E.B. White')).toBeVisible();
  });
});
