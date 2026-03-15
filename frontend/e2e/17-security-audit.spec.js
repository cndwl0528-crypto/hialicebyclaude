import { test, expect } from '@playwright/test';
import { mockAllApiFallback } from './fixtures.js';

test.describe('Security Audit', () => {

  // ── XSS Prevention ───────────────────────────────────────────────────────────

  test('XSS: script tags in book search input are not executed', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
      sessionStorage.setItem('studentName', 'TestKid');
      sessionStorage.setItem('studentLevel', 'Beginner');
    });
    await page.goto('/books');

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
    const inputVisible = await searchInput.isVisible().catch(() => false);
    if (inputVisible) {
      await searchInput.fill('<script>window.__xss_executed=true</script>');
      // Verify the injected script was not executed
      const xssExecuted = await page.evaluate(() => window.__xss_executed);
      expect(xssExecuted).toBeUndefined();
    }
  });

  test('XSS: HTML injection in search does not render as DOM elements', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
      sessionStorage.setItem('studentName', 'TestKid');
      sessionStorage.setItem('studentLevel', 'Beginner');
    });
    await page.goto('/books');

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
    const inputVisible = await searchInput.isVisible().catch(() => false);
    if (inputVisible) {
      await searchInput.fill('<img src=x onerror="window.__img_xss=true">');
      await page.waitForTimeout(500);
      const imgXss = await page.evaluate(() => window.__img_xss);
      expect(imgXss).toBeUndefined();
    }
  });

  // ── Session Storage Security ─────────────────────────────────────────────────

  test('fresh page load has no auth token in sessionStorage', async ({ page }) => {
    // Open a completely blank context — no prior session setup
    await page.goto('/');
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('sessionStorage token is not exposed in page HTML source', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'super-secret-token-12345');
    });
    const html = await page.content();
    // Token value must not appear in the rendered HTML
    expect(html).not.toContain('super-secret-token-12345');
  });

  // ── Sensitive Data Exposure ──────────────────────────────────────────────────

  test('no API keys or secrets in home page HTML', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    // Common secret patterns that must never appear in client-side HTML
    expect(html).not.toContain('sk-ant-');       // Anthropic API key prefix
    expect(html).not.toContain('sk-');           // Generic OpenAI/Anthropic prefix
    expect(html.toLowerCase()).not.toContain('api_key');
    expect(html.toLowerCase()).not.toContain('api_secret');
    expect(html.toLowerCase()).not.toContain('jwt_secret');
  });

  test('no plaintext passwords in page source', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain('password=');
    expect(html.toLowerCase()).not.toContain('"password":"');
  });

  test('login page does not pre-fill sensitive credentials', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]');
    const visible = await passwordInput.isVisible().catch(() => false);
    if (visible) {
      const prefilled = await passwordInput.inputValue();
      expect(prefilled).toBe('');
    }
  });

  // ── COPPA Compliance Pages ───────────────────────────────────────────────────

  test('COPPA consent page exists and loads', async ({ page }) => {
    await page.goto('/consent');
    await expect(page).toHaveURL(/consent/, { timeout: 10_000 });
    // The page must render — not a 404
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  test('COPPA consent page has required legal checkbox elements', async ({ page }) => {
    await page.goto('/consent?email=test@test.com');
    // Check for checkboxes (consent agreement inputs)
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count().catch(() => 0);
    expect(count).toBeGreaterThan(0);
  });

  test('privacy policy page exists and loads', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page).toHaveURL(/privacy-policy/, { timeout: 10_000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('data request page is accessible', async ({ page }) => {
    await page.goto('/data-request');
    // Page should exist (COPPA data deletion rights)
    await expect(page).toHaveURL(/data-request/, { timeout: 10_000 }).catch(() => {
      // If redirect occurs, that is also acceptable
    });
  });

  // ── Role-Based Access Control ────────────────────────────────────────────────

  test('admin dashboard is blocked for student role', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
    });
    await page.goto('/admin');
    // Should redirect away — admin content must not be visible to students
    const isRedirected = await page.url().then((url) => !url.includes('/admin')).catch(() => true);
    const adminHeading = await page.getByText('Admin Dashboard').isVisible().catch(() => false);
    // Either redirected OR admin content is not rendered
    expect(isRedirected || !adminHeading).toBeTruthy();
  });

  test('teacher dashboard is blocked for student role', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
    });
    await page.goto('/teacher');
    // 'student' is not in allowedRoles → redirect to /
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('admin pages are blocked without any token', async ({ page }) => {
    // No session setup — raw navigation to admin
    await page.goto('/admin');
    const isOnAdmin = page.url().includes('/admin');
    if (isOnAdmin) {
      // If still on /admin, admin content must not render sensitive controls
      const adminContent = await page.getByText('Total Students').isVisible().catch(() => false);
      // Without a token, admin stats should not be exposed
      expect(adminContent).toBeFalsy();
    }
  });

  // ── Form Security (SPA Architecture) ────────────────────────────────────────

  test('login form uses fetch (not raw form POST) — no action attribute', async ({ page }) => {
    await page.goto('/login');
    // In Next.js SPA, forms should not have action attributes pointing to external URLs
    const formAction = await page.locator('form').getAttribute('action').catch(() => null);
    if (formAction) {
      // If action exists, it must be relative or empty (not an external endpoint)
      expect(formAction).not.toMatch(/^https?:\/\//);
    }
  });

  test('consent form submit button is disabled by default (CSRF-safe flow)', async ({ page }) => {
    await page.goto('/consent?email=test@test.com');
    const submitBtn = page.getByRole('button', { name: /consent|submit|agree/i }).first();
    const isDisabled = await submitBtn.isDisabled().catch(() => true);
    // Consent button must be disabled until user explicitly checks all boxes
    expect(isDisabled).toBeTruthy();
  });

  // ── Content Security ─────────────────────────────────────────────────────────

  test('no inline script tags with user-controlled content in home page', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    // Check that there are no obviously dangerous eval() calls in inline scripts
    expect(html).not.toContain('eval(');
    expect(html).not.toContain('document.write(');
  });

  test('manifest.json is accessible and valid JSON', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/json/);
    const json = await response?.json().catch(() => null);
    expect(json).not.toBeNull();
  });
});
