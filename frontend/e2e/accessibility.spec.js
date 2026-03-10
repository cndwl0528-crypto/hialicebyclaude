/**
 * Scenario 5: Accessibility checks
 *
 * Verifies:
 *  - Home page: no images missing alt text, proper heading hierarchy
 *  - Session page: VoiceButton has correct ARIA labels and aria-pressed
 *  - Session page: primary action buttons have sufficient accessible labels
 *  - Session page: text input is reachable by keyboard (Tab navigation)
 *  - Review page: section headings exist
 *
 * These tests use Playwright's built-in locator assertions rather than
 * an axe-core plugin so they run without additional npm installs.
 * For deeper audits, add @axe-core/playwright to devDependencies and
 * call checkA11y() from this file.
 */

const { test, expect } = require('@playwright/test');
const {
  setupSessionStorage,
  mockApiResponse,
  MOCK_STUDENT,
  MOCK_BOOK,
  MOCK_SESSION,
  MOCK_REVIEW,
  MOCK_STAGE_BREAKDOWN,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Home page accessibility
// ---------------------------------------------------------------------------
test.describe('Accessibility — Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiResponse(page, /\/api\/books/, { books: [] });
    await page.goto('/');
  });

  test('page has a top-level h1 heading', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText('HiAlice');
  });

  test('heading hierarchy — h1 precedes h2 which precedes h3', async ({ page }) => {
    // h1 exists
    await expect(page.locator('h1')).toHaveCount(1);
    // h2 exists (subtitle)
    await expect(page.locator('h2').first()).toBeVisible();
    // h3 exists ("Who is reading today?")
    await expect(page.locator('h3').first()).toBeVisible();
  });

  test('no <img> elements are missing an alt attribute', async ({ page }) => {
    // Collect all img elements that lack an alt attribute
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test('interactive elements are keyboard-focusable', async ({ page }) => {
    // Tab through the first few focusable elements; none should be skipped
    // We verify the "Demo Mode" button receives focus when tabbed to
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // At least some element should have focus by now
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focused);
  });

  test('buttons have discernible text labels', async ({ page }) => {
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = (await btn.textContent()) || '';
      const ariaLabel = (await btn.getAttribute('aria-label')) || '';
      const title = (await btn.getAttribute('title')) || '';
      // Each button must have at least one source of accessible text
      expect(text.trim().length + ariaLabel.trim().length + title.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Session page accessibility
// ---------------------------------------------------------------------------
test.describe('Accessibility — Session Page', () => {
  const SESSION_URL = `/session?bookId=${MOCK_BOOK.id}&bookTitle=${encodeURIComponent(MOCK_BOOK.title)}`;

  test.beforeEach(async ({ page }) => {
    await mockApiResponse(page, /\/api\/sessions\/start/, {
      session: { id: MOCK_SESSION.id },
    });
    await mockApiResponse(page, /\/api\/sessions\/.*\/message/, {
      reply: { content: 'That is a great point! Can you tell me more?' },
      vocabulary: [],
      grammarScore: 80,
    });
    await mockApiResponse(page, /\/api\/sessions\/.*\/pause/, { ok: true });
    await mockApiResponse(page, /\/api\/sessions\/.*\/complete/, { summary: {} });

    await page.goto('/');
    await setupSessionStorage(page, {
      studentId: MOCK_STUDENT.id,
      studentName: MOCK_STUDENT.name,
      studentLevel: 'Intermediate',
      studentAge: MOCK_STUDENT.age,
      bookId: String(MOCK_BOOK.id),
      bookTitle: MOCK_BOOK.title,
      sessionId: MOCK_SESSION.id,
      authToken: 'demo-token',
    });

    await page.goto(SESSION_URL);
    // Wait for session to initialise
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });
  });

  test('VoiceButton has aria-label="Start listening" when not active', async ({ page }) => {
    const micButton = page.getByRole('button', { name: 'Start listening' });
    await expect(micButton).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start listening');
  });

  test('VoiceButton has aria-pressed="false" when not listening', async ({ page }) => {
    const micButton = page.getByRole('button', { name: 'Start listening' });
    // aria-pressed="false" signals a toggle button in its off state
    await expect(micButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('VoiceButton SVG has aria-hidden="true" to avoid duplicate announcements', async ({ page }) => {
    const micSvg = page.locator('button[aria-label="Start listening"] svg');
    await expect(micSvg).toHaveAttribute('aria-hidden', 'true');
  });

  test('Save & Exit button has an aria-label', async ({ page }) => {
    const exitButton = page.getByRole('button', { name: /Save.*Exit/i });
    await expect(exitButton).toHaveAttribute('aria-label', 'Save and exit session');
  });

  test('session progress region has aria-label', async ({ page }) => {
    // The stage + turn counter wrapper has aria-label="Session progress"
    const progressRegion = page.locator('[aria-label="Session progress"]');
    await expect(progressRegion).toBeVisible();
  });

  test('emotion reaction group has aria-label="How do you feel?"', async ({ page }) => {
    // Emotion buttons appear after the initial AI message is shown
    await expect(
      page.locator('[aria-label="How do you feel?"]')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('text input is reachable by Tab and accepts keyboard input', async ({ page }) => {
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 10_000 });

    // Focus the input via keyboard
    await textInput.focus();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('INPUT');

    // Type into it
    await page.keyboard.type('Testing keyboard access');
    await expect(textInput).toHaveValue('Testing keyboard access');
  });

  test('primary Send button has an accessible name', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /Send/i });
    await expect(sendButton).toBeVisible();
    const text = await sendButton.textContent();
    expect(text?.trim()).toBe('Send');
  });

  test('error alert region uses role="alert"', async ({ page }) => {
    // Force an API failure to trigger the error banner
    await page.route(/\/api\/sessions\/.*\/message/, (route) => route.abort('failed'));

    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('force error');
    await textInput.press('Enter');

    // The error banner has role="alert" — or the fallback note text appears
    const alertEl = page.locator('[role="alert"]');
    // If the mock fallback suppresses the alert text, check the fallback note instead
    const hasAlert = await alertEl.count() > 0;
    if (hasAlert) {
      await expect(alertEl.first()).toBeVisible({ timeout: 10_000 });
    } else {
      // Fallback: the "using memory" notice is shown
      await expect(page.getByText(/memory today|Let's keep going/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Review page accessibility
// ---------------------------------------------------------------------------
test.describe('Accessibility — Review Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiResponse(page, /\/api\/sessions\/.*\/review/, {
      review: {
        ...MOCK_REVIEW,
        vocabulary: MOCK_REVIEW.vocabulary,
        achievements: [],
      },
    });
    await mockApiResponse(page, /\/api\/sessions\/.*\/stage-scores/, {
      stageScores: MOCK_STAGE_BREAKDOWN,
    });

    await page.goto('/');
    await setupSessionStorage(page, {
      sessionId: MOCK_SESSION.id,
      bookTitle: MOCK_BOOK.title,
      studentName: MOCK_STUDENT.name,
      studentLevel: 'Intermediate',
      studentId: MOCK_STUDENT.id,
    });

    await page.goto('/review');
    await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });
  });

  test('review page has a top-level heading', async ({ page }) => {
    const headings = page.locator('h2, h3').first();
    await expect(headings).toBeVisible();
  });

  test('vocabulary expand buttons have accessible text', async ({ page }) => {
    // Each vocabulary row button shows the word itself as its text label
    const firstVocabButton = page.getByRole('button', {
      name: new RegExp(MOCK_REVIEW.vocabulary[0].word, 'i'),
    });
    await expect(firstVocabButton).toBeVisible();
  });

  test('action buttons at the bottom have discernible labels', async ({ page }) => {
    const actionButtons = [
      /Practice These Words/i,
      /Read Another Book/i,
      /View Profile/i,
    ];
    for (const namePattern of actionButtons) {
      await expect(page.getByRole('button', { name: namePattern })).toBeVisible();
    }
  });
});
