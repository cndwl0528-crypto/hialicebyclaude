import { test, expect } from '@playwright/test';
import { mockBooksApi, mockAllApiFallback } from './fixtures.js';

test.describe('Login & Student Selection', () => {
  test('home page renders with title and child selection', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/HiAlice/i, { timeout: 10_000 });
    await expect(page.getByText('Who is reading today?')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible();
  });

  test('clicking "Parent Login" shows login form with email and password', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Parent Login' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('login form shows validation error when fields are empty', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Parent Login' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Please fill in all fields')).toBeVisible();
  });

  test('"Back" button returns to child selection', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Parent Login' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Who is reading today?')).toBeVisible();
  });

  test('"Demo Mode — Try as Alice" navigates to /books', async ({ page }) => {
    await mockBooksApi(page);
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Demo Mode — Try as Alice' }).click();
    await expect(page).toHaveURL(/\/books/);
  });

  test('clicking a child card navigates to /books', async ({ page }) => {
    await mockBooksApi(page);
    await mockAllApiFallback(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'Alice', exact: true }).click();
    await expect(page).toHaveURL(/\/books/);
  });
});
