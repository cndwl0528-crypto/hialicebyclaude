import { test, expect } from '@playwright/test';
import { setParentSession, mockAllApiFallback } from './fixtures.js';

test.describe('Parent Dashboard', () => {
  test('redirects to / when no token in sessionStorage', async ({ page }) => {
    await page.goto('/parent');
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('renders dashboard header when authenticated with no children', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'p1', email: 'parent@test.com', children: [] }) })
    );
    await setParentSession(page);
    await page.goto('/parent');
    await expect(page.getByText('Parent Dashboard')).toBeVisible({ timeout: 10_000 });
  });

  test('shows child analytics when a child is linked', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ children: [{ id: '1', name: 'Alice', level: 'beginner', age: 8 }] }),
      })
    );
    await page.route('**/api/admin/students/*/analytics', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          student: { name: 'Alice', level: 'beginner', age: 8, totalBooks: 3, totalWords: 34, streak: 3 },
          sessions: [],
          vocabulary: { total: 34 },
        }),
      })
    );
    await page.route('**/api/auth/notifications', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) })
    );
    await setParentSession(page);
    await page.goto('/parent');
    await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Books Read')).toBeVisible();
  });
});
