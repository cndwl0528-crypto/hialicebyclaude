import { test, expect } from '@playwright/test';
import { setAdminSession, mockAdminBooksApi, mockAllApiFallback } from './fixtures.js';

test.describe('Admin Books Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await mockAdminBooksApi(page);
    await setAdminSession(page);
    await page.goto('/admin/books');
  });

  test('renders book list with title and author', async ({ page }) => {
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Eric Carle')).toBeVisible();
  });

  test('"Add New Book" opens the form modal', async ({ page }) => {
    await page.getByRole('button', { name: /add new book/i }).click();
    // Use exact placeholder to avoid matching search input ("Search by title, author, or genre...")
    await expect(page.getByPlaceholder('Book title')).toBeVisible();
    await expect(page.getByPlaceholder('Author name')).toBeVisible();
  });

  test('form shows validation error when title is empty', async ({ page }) => {
    await page.getByRole('button', { name: /add new book/i }).click();
    const submitBtn = page.getByRole('button', { name: /add book|save/i }).last();
    await submitBtn.click();
    await expect(page.getByText(/title.*required|required/i)).toBeVisible({ timeout: 5_000 });
  });
});
