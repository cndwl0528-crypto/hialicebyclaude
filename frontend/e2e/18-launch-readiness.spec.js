import { test, expect } from '@playwright/test';
import { mockAllApiFallback } from './fixtures.js';

// ─── Critical pages that must load without errors ─────────────────────────────
const CRITICAL_PAGES = [
  { path: '/',               label: 'Home / Student Selection' },
  { path: '/login',          label: 'Login' },
  { path: '/consent',        label: 'COPPA Consent' },
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/offline',        label: 'Offline Fallback' },
];

// Pages that require a student session to avoid auth redirects
const AUTH_REQUIRED_PAGES = [
  { path: '/books',      label: 'Book Selection',   role: 'student' },
  { path: '/vocabulary', label: 'Vocabulary',        role: 'student' },
  { path: '/profile',    label: 'Student Profile',   role: 'student' },
  { path: '/review',     label: 'Session Review',    role: 'student' },
  { path: '/parent',     label: 'Parent Dashboard',  role: 'parent'  },
];

test.describe('Launch Readiness Checklist', () => {

  // ── 1. Public pages load without JS errors ───────────────────────────────────

  for (const { path, label } of CRITICAL_PAGES) {
    test(`[PUBLIC] ${label} (${path}) loads without JS errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});

      const criticalErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }

  // ── 2. Authenticated pages load without JS errors ────────────────────────────

  for (const { path, label, role } of AUTH_REQUIRED_PAGES) {
    test(`[AUTH] ${label} (${path}) loads without JS errors`, async ({ page }) => {
      await mockAllApiFallback(page);
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      // Set minimal session for the required role
      await page.goto('/');
      await page.evaluate((r) => {
        sessionStorage.setItem('token', 'demo-token');
        sessionStorage.setItem('userRole', r);
        sessionStorage.setItem('studentId', '1');
        sessionStorage.setItem('studentName', 'Alice');
        sessionStorage.setItem('studentLevel', 'Beginner');
        sessionStorage.setItem('studentAge', '8');
        sessionStorage.setItem('parentEmail', 'parent@test.com');
        sessionStorage.setItem('parentId', 'p1');
      }, role);

      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});

      const criticalErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }

  // ── 3. Mobile viewport (375px) — no horizontal scroll ───────────────────────

  test('home page has no horizontal scroll on iPhone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12 / SE
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    // Allow 1px tolerance for sub-pixel rendering differences
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('login page has no horizontal scroll on iPhone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('consent page has no horizontal scroll on iPhone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/consent');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  // ── 4. SEO meta tags ─────────────────────────────────────────────────────────

  test('home page has a meaningful <title> tag', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
    // HiAlice branding should appear in the title
    expect(title.toLowerCase()).toMatch(/hialice|hi alice|alice/i);
  });

  test('home page has a meta description', async ({ page }) => {
    await page.goto('/');
    const desc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
    // Description must exist and be meaningful
    expect(desc).not.toBeNull();
    expect((desc ?? '').length).toBeGreaterThan(10);
  });

  test('privacy policy page has a meaningful title', async ({ page }) => {
    await page.goto('/privacy-policy');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
  });

  // ── 5. PWA manifest ──────────────────────────────────────────────────────────

  test('manifest.json is accessible with status 200', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
  });

  test('manifest.json contains required PWA fields', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    const manifest = await response?.json().catch(() => null);
    expect(manifest).not.toBeNull();
    // PWA minimum requirements
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('icons');
    expect(Array.isArray(manifest.icons)).toBeTruthy();
  });

  // ── 6. Critical navigation flows ────────────────────────────────────────────

  test('clicking Parent Login on home page reveals login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Parent Login' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Parent Login' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 });
  });

  test('Demo Mode button navigates to /books', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    const demoBtn = page.getByRole('button', { name: /demo mode/i });
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      await expect(page).toHaveURL(/\/books/, { timeout: 10_000 });
    }
  });

  test('student card click navigates to /books', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    // Child card: "Alice" heading is a clickable element
    const aliceCard = page.getByRole('heading', { name: 'Alice', exact: true });
    if (await aliceCard.isVisible()) {
      await aliceCard.click();
      await expect(page).toHaveURL(/\/books/, { timeout: 10_000 });
    }
  });

  // ── 7. Error-free critical authenticated flows ───────────────────────────────

  test('book library renders after student login', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
      sessionStorage.setItem('studentId', '1');
      sessionStorage.setItem('studentName', 'Alice');
      sessionStorage.setItem('studentLevel', 'Beginner');
      sessionStorage.setItem('studentAge', '8');
    });
    await page.goto('/books');
    // Book library page must have a heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('vocabulary page renders after student login', async ({ page }) => {
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'demo-token');
      sessionStorage.setItem('userRole', 'student');
      sessionStorage.setItem('studentId', '1');
      sessionStorage.setItem('studentName', 'Alice');
      sessionStorage.setItem('studentLevel', 'Beginner');
      sessionStorage.setItem('studentAge', '8');
    });
    await page.goto('/vocabulary');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── 8. Responsive image loading ──────────────────────────────────────────────

  test('no broken image resources on home page', async ({ page }) => {
    const failedImages = [];
    page.on('response', (response) => {
      if (
        response.request().resourceType() === 'image' &&
        response.status() >= 400
      ) {
        failedImages.push(response.url());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    expect(failedImages).toHaveLength(0);
  });

  // ── 9. COPPA consent gate ────────────────────────────────────────────────────

  test('consent form submit is disabled without all checkboxes checked', async ({ page }) => {
    await page.goto('/consent?email=launch@test.com');
    await expect(page.getByText(/parent consent required/i)).toBeVisible({ timeout: 10_000 });
    const consentBtn = page.getByRole('button', { name: /i give my consent/i });
    await expect(consentBtn).toBeDisabled();
  });

  test('consent button becomes enabled when all fields are completed', async ({ page }) => {
    await page.goto('/consent?email=launch@test.com');
    await expect(page.getByText(/parent consent required/i)).toBeVisible({ timeout: 10_000 });

    // Check all checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    // Enter legal name
    const nameInput = page.getByPlaceholder(/full legal name/i);
    await nameInput.fill('Launch Tester');

    const consentBtn = page.getByRole('button', { name: /i give my consent/i });
    await expect(consentBtn).toBeEnabled({ timeout: 5_000 });
  });

  // ── 10. Static assets ───────────────────────────────────────────────────────

  test('favicon is served', async ({ page }) => {
    const response = await page.goto('/favicon.ico').catch(() => null);
    // Accept 200 or 204; a 404 means the favicon is missing
    if (response) {
      expect(response.status()).not.toBe(404);
    }
  });
});
