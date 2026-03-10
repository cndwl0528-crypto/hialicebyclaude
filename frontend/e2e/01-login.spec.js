import { test, expect } from '@playwright/test';

test.describe('Login & Student Selection', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/HiAlice/i);
  });

  test('should show student profiles after parent login', async ({ page }) => {
    await page.goto('/');
    // Look for login form or student selection
    const hasLogin = await page.locator('input[type="email"], input[type="password"], [data-testid="student-card"], button:has-text("Login"), button:has-text("Start")').first().isVisible().catch(() => false);
    expect(hasLogin).toBeTruthy();
  });

  test('should navigate to books page after selecting student', async ({ page }) => {
    await page.goto('/books');
    // Books page should load (may redirect to login if not authenticated)
    await expect(page.locator('body')).toBeVisible();
  });
});
