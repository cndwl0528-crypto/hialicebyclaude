/**
 * Scenario 4: Review page
 *
 * Verifies:
 *  - Review page loads when sessionId is present in sessionStorage
 *  - Loads API data when available, falls back gracefully when unavailable
 *  - "Reading Session Complete!" heading is visible
 *  - Session Breakdown by Stage section renders all 4 stages
 *  - Vocabulary section (Vocabulary Details) renders word entries
 *  - Navigation buttons are present (Practice These Words, Read Another Book)
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

test.describe('Review Page', () => {
  test.describe('With API data', () => {
    test.beforeEach(async ({ page }) => {
      // Mock the review API endpoint
      await mockApiResponse(page, /\/api\/sessions\/.*\/review/, {
        review: {
          ...MOCK_REVIEW,
          vocabulary: MOCK_REVIEW.vocabulary,
          achievements: [],
        },
      });

      // Mock stage scores endpoint
      await mockApiResponse(page, /\/api\/sessions\/.*\/stage-scores/, {
        stageScores: MOCK_STAGE_BREAKDOWN,
      });

      // Seed sessionStorage — review page reads sessionId, bookTitle, studentName
      await page.goto('/');
      await setupSessionStorage(page, {
        sessionId: MOCK_SESSION.id,
        bookTitle: MOCK_BOOK.title,
        studentName: MOCK_STUDENT.name,
        studentLevel: 'Intermediate',
        studentId: MOCK_STUDENT.id,
      });

      await page.goto('/review');
    });

    test('renders the "Reading Session Complete!" heading', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });
    });

    test('shows the correct book title and student name', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText(new RegExp(MOCK_BOOK.title))).toBeVisible();
      await expect(
        page.getByText(new RegExp(MOCK_STUDENT.name))
      ).toBeVisible();
    });

    test('Session Summary card shows grammar and level scores', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText('Session Summary')).toBeVisible();
      await expect(page.getByText('Grammar Score')).toBeVisible();
    });

    test('Stage Breakdown section lists all 4 stages', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText('Session Breakdown by Stage')).toBeVisible();

      // All four stages from MOCK_STAGE_BREAKDOWN
      for (const stage of ['Title', 'Introduction', 'Body', 'Conclusion']) {
        await expect(page.getByText(stage, { exact: true })).toBeVisible();
      }
    });

    test('Vocabulary Details section is visible and shows word entries', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText('Vocabulary Details')).toBeVisible();

      // Each word from MOCK_REVIEW.vocabulary should appear
      for (const vocab of MOCK_REVIEW.vocabulary) {
        await expect(page.getByText(vocab.word, { exact: true }).first()).toBeVisible();
      }
    });

    test('Word Cloud section is rendered', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Your Word Cloud')).toBeVisible();
    });

    test('navigation buttons are visible at the bottom', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await expect(
        page.getByRole('button', { name: /Practice These Words/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Read Another Book/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /View Profile/i })
      ).toBeVisible();
    });

    test('"Practice These Words" navigates to /vocabulary', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /Practice These Words/i }).click();
      await page.waitForURL('**/vocabulary');
      expect(page.url()).toContain('/vocabulary');
    });

    test('"Read Another Book" navigates to /books', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      // Also intercept the books API for the resulting page
      await mockApiResponse(page, /\/api\/books/, { books: [] });
      await page.getByRole('button', { name: /Read Another Book/i }).click();
      await page.waitForURL('**/books');
      expect(page.url()).toContain('/books');
    });
  });

  test.describe('Fallback when API is unavailable', () => {
    test.beforeEach(async ({ page }) => {
      // Make both API calls fail — page should fall back to MOCK_REVIEW_DATA
      await page.route(/\/api\/sessions\/.*\/review/, (route) => route.abort('failed'));
      await page.route(/\/api\/sessions\/.*\/stage-scores/, (route) => route.abort('failed'));

      await page.goto('/');
      await setupSessionStorage(page, {
        sessionId: MOCK_SESSION.id,
        bookTitle: MOCK_BOOK.title,
        studentName: MOCK_STUDENT.name,
        studentLevel: 'Intermediate',
        studentId: MOCK_STUDENT.id,
      });

      await page.goto('/review');
    });

    test('shows fallback data and does not crash', async ({ page }) => {
      // Even with API failure the page renders with built-in MOCK_REVIEW_DATA
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });
    });

    test('shows offline / fallback notice banner', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });

      // The fallback notice uses "saved session data" text
      await expect(
        page.getByText(/saved session data|Using saved data/i)
      ).toBeVisible();
    });

    test('Vocabulary Details still visible with mock fallback data', async ({ page }) => {
      await expect(page.getByText('Reading Session Complete!')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Vocabulary Details')).toBeVisible();
    });
  });

  test.describe('No sessionId — error state', () => {
    test('shows an error message when sessionId is missing', async ({ page }) => {
      // No sessionStorage seeding — sessionId will be null
      await page.goto('/review');

      await expect(
        page.getByText(/No session found|Please complete a reading session/i)
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
