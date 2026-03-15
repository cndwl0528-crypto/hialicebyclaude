// @ts-check
const { test, expect } = require('@playwright/test');

// NOTE: Install @axe-core/playwright before running:
// npm install -D @axe-core/playwright

test.describe('axe-core WCAG 2.1 AA audit', () => {
  const pages = ['/', '/books', '/login', '/vocabulary', '/profile', '/review'];

  for (const pagePath of pages) {
    test(`${pagePath} passes axe-core AA`, async ({ page }) => {
      await page.goto(pagePath);

      // Skip if axe not installed
      let AxeBuilder;
      try {
        AxeBuilder = require('@axe-core/playwright').default;
      } catch {
        test.skip(true, '@axe-core/playwright not installed');
        return;
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
