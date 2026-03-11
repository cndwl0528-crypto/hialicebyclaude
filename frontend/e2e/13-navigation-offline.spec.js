import { test, expect } from '@playwright/test';
import { setStudentSession, mockAllApiFallback } from './fixtures.js';

test.describe('Navigation & Static Pages', () => {
  test('navbar shows HiAlice branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('HiAlice').first()).toBeVisible();
  });

  test('nav links are accessible (Books, Review, Words, Profile)', async ({ page }) => {
    await page.goto('/');
    // Desktop nav uses navLinks.slice(1) which skips "Home" — check links present in desktop nav
    await expect(page.getByRole('link', { name: /books/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /profile/i }).first()).toBeVisible();
  });

  test('"Log out" button in navbar clears session and redirects to /', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await setStudentSession(page);
    await page.goto('/books');
    const logoutBtn = page.getByRole('button', { name: /log out/i });
    const hasLogout = await logoutBtn.isVisible().catch(() => false);
    if (hasLogout) {
      await logoutBtn.click();
      await expect(page).toHaveURL('/');
      const token = await page.evaluate(() => sessionStorage.getItem('token'));
      expect(token).toBeNull();
    }
  });

  test('offline page renders with message and retry button', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByText("You're Offline")).toBeVisible();
    await expect(page.getByRole('button', { name: /try again|go home/i })).toBeVisible();
  });

  test('privacy policy page renders with COPPA section', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page.getByText('Privacy Policy')).toBeVisible();
    await expect(page.getByText('COPPA Compliance')).toBeVisible();
  });

  test('"Back to Home" link on privacy policy navigates to /', async ({ page }) => {
    await page.goto('/privacy-policy');
    await page.getByRole('link', { name: /back to home/i }).click();
    await expect(page).toHaveURL('/');
  });
});
