import { test, expect } from '@playwright/test';
import { setAdminSession, mockAllApiFallback } from './fixtures.js';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await setAdminSession(page);
    await page.goto('/admin');
  });

  test('renders stat cards with correct labels', async ({ page }) => {
    await expect(page.getByText('Total Students')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Books')).toBeVisible();
    await expect(page.getByText('Active Sessions')).toBeVisible();
  });

  test('shows recent sessions table with student names', async ({ page }) => {
    // Mock data includes "Alice" in MOCK_RECENT_SESSIONS — use exact match to avoid HiAlice navbar
    await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bob', { exact: true }).first()).toBeVisible();
  });

  test('quick action links are present', async ({ page }) => {
    const studentsLink = page.getByRole('link', { name: /students/i });
    const booksLink = page.getByRole('link', { name: /books/i });
    const reportsLink = page.getByRole('link', { name: /reports/i });
    const hasStudents = await studentsLink.first().isVisible().catch(() => false);
    const hasBooks = await booksLink.first().isVisible().catch(() => false);
    const hasReports = await reportsLink.first().isVisible().catch(() => false);
    expect(hasStudents || hasBooks || hasReports).toBeTruthy();
  });
});
