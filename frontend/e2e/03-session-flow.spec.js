import { test, expect } from '@playwright/test';
import { setStudentSession, mockAllApiFallback } from './fixtures.js';

test.describe('Q&A Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiFallback(page);
    await page.route('**/api/sessions/start', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ session: { id: 'session-001', stage: 'Warm Connection' } }),
      })
    );
    await page.route('**/api/sessions/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    );
    await setStudentSession(page);
    await page.evaluate(() => {
      sessionStorage.setItem('sessionId', 'session-001');
      sessionStorage.setItem('bookId', '1');
      sessionStorage.setItem('bookTitle', 'The Very Hungry Caterpillar');
    });
    await page.goto('/session?bookId=1&bookTitle=The+Very+Hungry+Caterpillar');
  });

  test('renders session interface with stage indicators', async ({ page }) => {
    await expect(page.getByText('Warm Connection').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Introduction').first()).toBeVisible();
  });

  test('shows voice input button or text input', async ({ page }) => {
    const micButton = page.getByRole('button', { name: /start listening/i });
    const textarea = page.locator('textarea');
    const hasVoice = await micButton.isVisible().catch(() => false);
    const hasText = await textarea.isVisible().catch(() => false);
    expect(hasVoice || hasText).toBeTruthy();
  });

  test('text input accepts typed text', async ({ page }) => {
    const textarea = page.locator('textarea');
    const isVisible = await textarea.isVisible().catch(() => false);
    if (isVisible) {
      await textarea.fill('I liked the caterpillar!');
      await expect(textarea).toHaveValue('I liked the caterpillar!');
    }
  });
});
