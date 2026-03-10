/**
 * Scenario 2: Book selection page
 *
 * Verifies:
 *  - Books grid renders (using mock data fallback when API unavailable)
 *  - Level filter buttons are present and clickable
 *  - Filtering changes the visible book set
 *  - Clicking a book navigates to /session
 */

const { test, expect } = require('@playwright/test');
const {
  setupStudentSession,
  mockApiResponse,
  abortApiRequest,
  MOCK_BOOK,
} = require('./helpers');

// Full mock books list mirroring MOCK_BOOKS in books/page.js
const MOCK_BOOKS_RESPONSE = {
  books: [
    { id: 1, title: 'The Very Hungry Caterpillar', author: 'Eric Carle', level: 'Beginner', genre: 'Picture Book', cover: '🐛', description: 'A tiny caterpillar.' },
    { id: 2, title: 'Where the Wild Things Are', author: 'Maurice Sendak', level: 'Beginner', genre: 'Picture Book', cover: '👹', description: 'Max sails away.' },
    { id: 3, title: "Charlotte's Web", author: 'E.B. White', level: 'Intermediate', genre: 'Chapter Book', cover: '🕷️', description: 'A pig and a spider.' },
    { id: 4, title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', level: 'Intermediate', genre: 'Fantasy', cover: '🦁', description: 'A magical world.' },
    { id: 6, title: 'A Wrinkle in Time', author: "Madeleine L'Engle", level: 'Advanced', genre: 'Science Fiction', cover: '⭐', description: 'A girl searches.' },
  ],
};

test.describe('Book Selection Page', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept session start so /session doesn't break during navigation checks
    await mockApiResponse(page, /\/api\/sessions\/start/, {
      session: { id: 'session-test-001' },
    });
    // Intercept books API with mock data
    await mockApiResponse(page, /\/api\/books/, MOCK_BOOKS_RESPONSE);

    // Navigate to the origin first, then seed sessionStorage, then go to /books
    await page.goto('/');
    await setupStudentSession(page, { studentLevel: 'Intermediate' });
    await page.goto('/books');
  });

  test('renders the books grid heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Select a Book/i })).toBeVisible();
  });

  test('books grid displays multiple book cards', async ({ page }) => {
    // Wait for loading state to clear — the loading spinner has "Loading books..."
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    // Each book card has a "Start Reading" button
    const startButtons = page.getByRole('button', { name: /Start Reading/i });
    await expect(startButtons).toHaveCount(5);
  });

  test('displays level filter buttons for All, Beginner, Intermediate, Advanced', async ({ page }) => {
    const filters = ['All', 'Beginner', 'Intermediate', 'Advanced'];
    for (const label of filters) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('level filter — Beginner shows only Beginner books', async ({ page }) => {
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Beginner', exact: true }).click();

    // Beginner books visible
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible();
    await expect(page.getByText('Where the Wild Things Are')).toBeVisible();

    // Intermediate / Advanced books should not appear
    await expect(page.getByText("Charlotte's Web")).toBeHidden();
    await expect(page.getByText('A Wrinkle in Time')).toBeHidden();
  });

  test('level filter — Advanced shows only Advanced books', async ({ page }) => {
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Advanced', exact: true }).click();

    await expect(page.getByText('A Wrinkle in Time')).toBeVisible();
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeHidden();
  });

  test('level filter — All restores full grid after filtering', async ({ page }) => {
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Beginner', exact: true }).click();
    await expect(page.getByText('A Wrinkle in Time')).toBeHidden();

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByText('A Wrinkle in Time')).toBeVisible();
  });

  test('search bar filters books by title', async ({ page }) => {
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder(/Search by title/i);
    await searchInput.fill('caterpillar');

    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible();
    await expect(page.getByText("Charlotte's Web")).toBeHidden();
  });

  test('clicking a book card navigates to /session with bookId and bookTitle params', async ({ page }) => {
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    // Click the first "Start Reading" button
    await page.getByRole('button', { name: /Start Reading/i }).first().click();

    await page.waitForURL(/\/session/);
    const url = page.url();
    expect(url).toContain('/session');
    expect(url).toContain('bookId=');
    expect(url).toContain('bookTitle=');
  });

  test('shows fallback mock data when API is unreachable', async ({ page }) => {
    // Override: make the books API fail
    await page.route(/\/api\/books/, (route) => route.abort('failed'));

    await page.goto('/');
    await setupStudentSession(page);
    await page.goto('/books');

    // Wait for loading to finish
    await expect(page.getByText('Loading books...')).toBeHidden({ timeout: 10_000 });

    // Mock books from the page source code should be shown
    await expect(page.getByText('The Very Hungry Caterpillar')).toBeVisible();
  });
});
