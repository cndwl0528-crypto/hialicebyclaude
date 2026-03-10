/**
 * Scenario 1: Home page navigation
 *
 * Verifies:
 *  - Home page loads and shows HiAlice branding
 *  - Student selection cards are rendered
 *  - Clicking a student card navigates to /books
 */

const { test, expect } = require('@playwright/test');
const { mockApiResponse } = require('./helpers');

test.describe('Home Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend books API that books page fires — prevents timeout noise
    await mockApiResponse(page, /\/api\/books/, { books: [] });
  });

  test('loads the home page and shows HiAlice branding', async ({ page }) => {
    await page.goto('/');

    // The h1 contains the brand name
    await expect(page.locator('h1')).toContainText('HiAlice');

    // Subtitle / tagline visible
    await expect(page.locator('h2').first()).toContainText('English Reading Adventure');

    // AI-powered description text
    await expect(page.getByText('AI-powered English reading')).toBeVisible();
  });

  test('shows student selection heading and at least one student card', async ({ page }) => {
    await page.goto('/');

    // "Who is reading today?" heading
    await expect(page.getByText('Who is reading today?')).toBeVisible();

    // The page renders MOCK_CHILDREN: Alice and Bob
    // Each card has the child's name as an h4
    const cards = page.locator('h4');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Alice');
    await expect(cards.nth(1)).toContainText('Bob');
  });

  test('each student card displays age and level badge', async ({ page }) => {
    await page.goto('/');

    // Age shown as "Age 8"
    await expect(page.getByText('Age 8')).toBeVisible();
    await expect(page.getByText('Age 11')).toBeVisible();

    // Level badges
    await expect(page.getByText('Beginner')).toBeVisible();
    await expect(page.getByText('Intermediate')).toBeVisible();
  });

  test('clicking a student card navigates to /books', async ({ page }) => {
    await page.goto('/');

    // Click the first student card — the entire card div is the clickable element.
    // The card wraps an h4 with the child name; click the "Alice" card area.
    const firstCard = page.locator('h4').first().locator('../..');
    await firstCard.click();

    // Should land on /books
    await page.waitForURL('**/books');
    expect(page.url()).toContain('/books');
  });

  test('Demo Mode button sets sessionStorage and navigates to /books', async ({ page }) => {
    await page.goto('/');

    const demoButton = page.getByRole('button', { name: /Demo Mode/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    await page.waitForURL('**/books');

    // sessionStorage should have been seeded
    const studentId = await page.evaluate(() => sessionStorage.getItem('studentId'));
    const studentName = await page.evaluate(() => sessionStorage.getItem('studentName'));
    expect(studentId).not.toBeNull();
    expect(studentName).toBe('Alice');
  });

  test('Parent Login button reveals login form', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Parent Login/i }).click();

    // Login form inputs visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();

    // Back button returns to student selection
    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page.getByText('Who is reading today?')).toBeVisible();
  });

  test('feature hint tiles are visible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Voice Learning')).toBeVisible();
    await expect(page.getByText('Curated Books')).toBeVisible();
    await expect(page.getByText('Smart Feedback')).toBeVisible();
  });
});
