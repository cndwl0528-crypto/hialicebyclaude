import { test, expect } from '@playwright/test';
import { setStudentSession, mockAllApiFallback } from './fixtures.js';

test.describe('Student Profile', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await page.route('**/api/sessions/student/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [], stats: {} }) })
    );
    await page.route('**/api/admin/students/*/analytics', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ achievements: [] }) })
    );
    await page.route('**/api/vocabulary/*/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalWords: 34, masteredWords: 10, learningWords: 24 }) })
    );
    await setStudentSession(page);
    await page.goto('/profile');
  });

  test('shows student name and level', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Beginner', { exact: true }).first()).toBeVisible();
  });

  test('shows stat labels (Books Read, Words Learned, Day Streak)', async ({ page }) => {
    await expect(page.getByText('Books Read', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Words Learned', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Day Streak', { exact: true })).toBeVisible();
  });

  test('shows "Your Badges" section', async ({ page }) => {
    await expect(page.getByText('Your Badges')).toBeVisible({ timeout: 10_000 });
  });

  test('"Log out" button clears session and redirects to /', async ({ page }) => {
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.getByRole('button', { name: /log out/i }).last().click();
    await expect(page).toHaveURL('/');
  });
});
