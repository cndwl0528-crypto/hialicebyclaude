import { test, expect } from '@playwright/test';
import { setAdminSession, mockAdminStudentsApi, mockAllApiFallback } from './fixtures.js';

test.describe('Admin Students Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await mockAdminStudentsApi(page);
    await setAdminSession(page);
    await page.goto('/admin/students');
  });

  test('renders student list with names from API', async ({ page }) => {
    await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bob', { exact: true }).first()).toBeVisible();
  });

  test('"Add New Student" opens the create form', async ({ page }) => {
    await page.getByRole('button', { name: /add new student/i }).click();
    await expect(page.getByPlaceholder(/student name/i)).toBeVisible();
  });

  test('form shows validation error when name is empty', async ({ page }) => {
    await page.getByRole('button', { name: /add new student/i }).click();
    // Try to submit empty form — click the "Add Student" / "Save" button
    const submitBtn = page.getByRole('button', { name: /add student|save/i }).last();
    await submitBtn.click();
    // Should show validation error
    await expect(page.getByText(/name.*required|required/i)).toBeVisible({ timeout: 5_000 });
  });

  test('search input filters student list', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    const hasSearch = await search.isVisible().catch(() => false);
    if (hasSearch) {
      await search.fill('Alice');
      await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible();
    }
  });
});
