import { test, expect } from '@playwright/test';

test.describe('COPPA Consent Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/consent?email=parent@test.com');
    await expect(page.getByText('Parent Consent Required')).toBeVisible();
  });

  test('renders all three checkboxes and name field', async ({ page }) => {
    await expect(page.getByText('I am the parent or legal guardian')).toBeVisible();
    await expect(page.getByText('I consent to the collection')).toBeVisible();
    await expect(page.getByText('I consent to voice processing')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your full legal name')).toBeVisible();
  });

  test('"I Give My Consent" button is disabled until all fields are filled', async ({ page }) => {
    const consentBtn = page.getByRole('button', { name: 'I Give My Consent' });
    await expect(consentBtn).toBeDisabled();
  });

  test('button becomes enabled when all checkboxes checked and name entered', async ({ page }) => {
    // Check all three checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    // Fill name (must be > 2 chars)
    await page.getByPlaceholder('Enter your full legal name').fill('Jane Smith');
    const consentBtn = page.getByRole('button', { name: 'I Give My Consent' });
    await expect(consentBtn).toBeEnabled();
  });

  test('shows error when API call fails', async ({ page }) => {
    // Mock the consent endpoint to return 500 — use exact URL pattern to match fetch()
    await page.route('**/api/auth/consent', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );
    // Fill all fields
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByPlaceholder('Enter your full legal name').fill('Jane Smith');
    // Wait for React to re-render and enable the button
    const consentBtn = page.getByRole('button', { name: 'I Give My Consent' });
    await expect(consentBtn).toBeEnabled({ timeout: 5_000 });
    await consentBtn.click();
    // Next.js has a hidden route-announcer div with role="alert", so use text match instead
    await expect(page.getByText('Failed to record consent')).toBeVisible({ timeout: 10_000 });
  });
});
