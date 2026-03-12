import { chromium } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:5177';

async function expectVisible(page, selector, description) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  console.log(`ok: ${description}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`opened: ${page.url()}`);

    await expectVisible(page, 'text=I\'m a Student', 'login options rendered');
    await page.getByRole('button', { name: /I\'m a Student/i }).click();
    await expectVisible(page, 'text=Who are you?', 'student chooser visible');
    await page.getByRole('button', { name: /Alice/i }).click();

    await page.waitForURL('**/books', { timeout: 15000 });
    console.log(`navigated: ${page.url()}`);

    await expectVisible(page, 'text=Start', 'top navigation rendered');
    await expectVisible(page, 'text=Profile', 'logged-in menu rendered');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await expectVisible(page, 'text=Start', 'menu still visible after reload');
    await expectVisible(page, 'text=Profile', 'profile menu still visible after reload');

    console.log('smoke menu persistence passed');
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error('smoke flow failed');
  console.error(error);
  process.exitCode = 1;
});
