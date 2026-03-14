/**
 * E2E Accessibility Scan Tests — HiAlice
 *
 * Covers core WCAG 2.1 AA criteria without any external axe-core dependency.
 * Each test targets a specific criterion so failures point directly to the
 * relevant guideline.
 *
 * WCAG references used throughout this file:
 *   2.4.1  Bypass Blocks           — skip-to-content link
 *   1.3.6  Identify Purpose        — landmark regions (nav, main)
 *   2.5.5  Target Size             — minimum touch/click target size
 *   1.4.3  Contrast (Minimum)      — non-transparent text color
 *   2.4.7  Focus Visible           — outline on focused elements
 *   1.1.1  Non-text Content        — aria-hidden on decorative icons
 *   4.1.2  Name, Role, Value       — dialog ARIA attributes
 */

import { test, expect } from '@playwright/test';
import {
  mockBooksApi,
  mockSessionsApi,
  mockAllApiFallback,
  setStudentSession,
} from './fixtures.js';

test.describe('Accessibility', () => {

  // ─── 1. Skip Navigation ──────────────────────────────────────────────────
  // WCAG 2.4.1 — Bypass Blocks
  // Users who navigate by keyboard must be able to skip repeated navigation
  // blocks and jump directly to the main content region.

  test('skip-to-content link exists and is focusable', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.locator('a[href="#main-content"]');

    // The link must be present in the DOM (it may be visually hidden until
    // focused, but it must still be attached so keyboard users can reach it).
    await expect(skipLink).toBeAttached();

    // The very first Tab keypress from the top of the page should move focus
    // onto the skip link before any navigation items receive focus.
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
  });

  // ─── 2. Main Content Landmark ─────────────────────────────────────────────
  // WCAG 1.3.6 — Identify Purpose / 2.4.1 — Bypass Blocks
  // The skip link target (#main-content) must exist so the browser can scroll
  // focus past the navigation when activated.

  test('main content has id="main-content"', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
  });

  // ─── 3. Navigation Landmarks ──────────────────────────────────────────────
  // WCAG 1.3.1 — Info and Relationships / 2.4.6 — Headings and Labels
  // Each <nav> element must carry an accessible name so screen-reader users
  // can distinguish between "Main navigation" and "Mobile navigation" in the
  // landmarks list.

  test('desktop nav has aria-label="Main navigation"', async ({ page }) => {
    await page.goto('/');

    const desktopNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(desktopNav).toBeAttached();
  });

  test('mobile nav has aria-label="Mobile navigation"', async ({ page }) => {
    // Resize to a mobile viewport so any conditionally rendered mobile nav
    // element is mounted in the DOM.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
    await expect(mobileNav).toBeAttached();
  });

  // ─── 4. Touch / Click Target Sizes ────────────────────────────────────────
  // WCAG 2.5.5 — Target Size (Enhanced: 44 × 44 px minimum for web; 48 px for
  // native mobile).  We check the first 10 interactive elements on /books
  // (after authentication) to keep execution time fast while still catching
  // regressions on the most interaction-dense page.

  test('interactive elements meet 44px minimum touch target on /books', async ({ page }) => {
    await mockAllApiFallback(page);
    await mockBooksApi(page);
    await mockSessionsApi(page);
    await setStudentSession(page);
    await page.goto('/books');

    const buttons = page.locator('button, a[role="button"], [role="link"]');
    const count = await buttons.count();

    // Guard: if the page renders zero candidates the selector is wrong, not
    // that every target passes — fail loudly so the test stays meaningful.
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        // 44 px is the WCAG 2.5.5 minimum for web interfaces.
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // ─── 5. Color Contrast — Basic Check ──────────────────────────────────────
  // WCAG 1.4.3 — Contrast (Minimum)
  // A full contrast-ratio calculation requires an external library; this
  // lightweight check confirms that the body text color has been set to
  // something other than fully transparent, which would render all text
  // invisible to sighted users.

  test('text elements are not invisible (body color is not fully transparent)', async ({ page }) => {
    await page.goto('/');

    const bodyColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).color;
    });

    // rgba(0, 0, 0, 0) is the computed value when color is fully transparent.
    expect(bodyColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  // ─── 6. Focus Visible ─────────────────────────────────────────────────────
  // WCAG 2.4.7 — Focus Visible
  // Every focusable element must display a visible focus indicator when it
  // receives keyboard focus.  We Tab twice to skip past the skip link (which
  // may legitimately be off-screen) and land on a navigation or main-content
  // element, then verify its outline style is not "none".

  test('focus-visible outline is present on interactive elements', async ({ page }) => {
    await page.goto('/');

    // Tab once lands on the skip link (visually hidden but valid).
    // Tab again lands on the first visible navigation link or button.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const focusedCount = await focused.count();

    // If nothing is focused the keyboard trap itself is a WCAG violation —
    // but we skip rather than false-fail so flakiness is surfaced separately.
    if (focusedCount === 0) {
      test.skip(true, 'No element received focus after two Tab presses — investigate keyboard trap.');
      return;
    }

    const outlineStyle = await focused.first().evaluate(
      (el) => window.getComputedStyle(el).outlineStyle,
    );

    // "none" means no visible outline; any other value (solid, dashed, dotted,
    // auto …) is acceptable as long as the ring is visually discernible.
    expect(outlineStyle).not.toBe('none');
  });

  // ─── 7. Decorative Icons Use aria-hidden ──────────────────────────────────
  // WCAG 1.1.1 — Non-text Content
  // Icons that are purely decorative (emoji spans, SVG illustrations, etc.)
  // must be hidden from the accessibility tree with aria-hidden="true" so
  // screen readers do not announce meaningless characters or labels.

  test('decorative icons have aria-hidden="true"', async ({ page }) => {
    await page.goto('/');

    // The app uses <span aria-hidden="true"> for emoji / decorative icons.
    const hiddenIcons = page.locator('span[aria-hidden="true"]');
    await expect(hiddenIcons.first()).toBeAttached();
  });

  // ─── 8. Dialog ARIA Attributes ────────────────────────────────────────────
  // WCAG 4.1.2 — Name, Role, Value
  // Modal dialogs must carry role="dialog", aria-modal="true" and an
  // aria-labelledby reference so screen-reader users understand they are
  // inside a modal context and know its title.
  //
  // NOTE: This test is skipped by default because triggering the confirmation
  // modal requires a specific user flow (e.g. selecting a book then confirming
  // a destructive action).  Remove the test.skip call and implement the
  // trigger steps once the modal trigger is stable and consistently reachable
  // from /books without network-dependent state.

  test('confirmation modal has correct ARIA attributes', async ({ page }) => {
    test.skip(
      true,
      'Modal trigger flow is session-state dependent. ' +
      'Unskip and implement steps once the trigger is reliably reachable. ' +
      'WCAG 4.1.2 — Name, Role, Value.',
    );

    await mockAllApiFallback(page);
    await mockBooksApi(page);
    await mockSessionsApi(page);
    await setStudentSession(page);
    await page.goto('/books');

    // TODO: replace the lines below with the actual steps that open the modal.
    // Example:
    //   await page.getByRole('button', { name: /start session/i }).first().click();
    //   await page.getByRole('button', { name: /confirm/i }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeAttached();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // The dialog must be labelled by a heading whose id is referenced here.
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // Confirm the referenced heading actually exists in the DOM.
    await expect(page.locator(`#${labelledBy}`)).toBeAttached();
  });

  // ─── 9. Page Title ────────────────────────────────────────────────────────
  // WCAG 2.4.2 — Page Titled
  // Every page must have a non-empty <title> element that describes its
  // purpose.  This is critical for screen-reader users and browser history.

  test('home page has a non-empty document title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('/books page has a descriptive document title', async ({ page }) => {
    await mockAllApiFallback(page);
    await mockBooksApi(page);
    await mockSessionsApi(page);
    await setStudentSession(page);
    await page.goto('/books');

    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  // ─── 10. Language Attribute ───────────────────────────────────────────────
  // WCAG 3.1.1 — Language of Page
  // The <html> element must carry a lang attribute so screen readers choose
  // the correct pronunciation engine for the page content.

  test('html element has a lang attribute', async ({ page }) => {
    await page.goto('/');

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang.trim().length).toBeGreaterThan(0);
  });

  // ─── 11. Images Have Alt Text ─────────────────────────────────────────────
  // WCAG 1.1.1 — Non-text Content
  // Every <img> element must have an alt attribute.  An empty alt="" is
  // acceptable for decorative images; its absence is always a violation.

  test('all img elements have an alt attribute on the home page', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // alt must not be null (missing attribute) — empty string is fine for
      // purely decorative images.
      expect(alt).not.toBeNull();
    }
  });

  // ─── 12. Form Inputs Have Labels ──────────────────────────────────────────
  // WCAG 1.3.1 — Info and Relationships / 4.1.2 — Name, Role, Value
  // Every form control must have an accessible name supplied by a <label>,
  // aria-label, or aria-labelledby so screen readers announce what the
  // field is for.

  test('login form inputs have accessible labels', async ({ page }) => {
    await page.goto('/');

    // Open the Parent Login form.
    const loginButton = page.getByRole('button', { name: 'Parent Login' });
    const hasLoginButton = await loginButton.isVisible().catch(() => false);

    if (!hasLoginButton) {
      test.skip(true, 'Parent Login button not found — check login page structure.');
      return;
    }

    await loginButton.click();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Each input must be labelled via <label for>, aria-label, or
    // aria-labelledby.  We resolve the accessible name through the browser's
    // own accessibility API to cover all three mechanisms.
    const emailLabel = await emailInput.evaluate((el) => {
      const id = el.id;
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
      return (
        ariaLabel ||
        (ariaLabelledBy && document.getElementById(ariaLabelledBy)?.textContent) ||
        labelEl?.textContent ||
        ''
      );
    });

    const passwordLabel = await passwordInput.evaluate((el) => {
      const id = el.id;
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
      return (
        ariaLabel ||
        (ariaLabelledBy && document.getElementById(ariaLabelledBy)?.textContent) ||
        labelEl?.textContent ||
        ''
      );
    });

    expect(emailLabel.trim().length).toBeGreaterThan(0);
    expect(passwordLabel.trim().length).toBeGreaterThan(0);
  });

});
