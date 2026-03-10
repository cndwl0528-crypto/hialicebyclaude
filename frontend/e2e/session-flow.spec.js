/**
 * Scenario 3: Session flow (Q&A interaction)
 *
 * Verifies:
 *  - Session page loads with 6-stage worksheet indicators (Warm-Up → Reflection)
 *  - AI opening question is displayed in the chat
 *  - Text input is available for Intermediate/Advanced students
 *  - Typing a response and submitting shows student message
 *  - AI responds after submission (mock or real)
 *
 * NOTE: The session page reads bookId and bookTitle from URL search params
 * (window.location.search) and studentId/studentLevel from sessionStorage.
 * We seed these before navigating to /session.
 */

const { test, expect } = require('@playwright/test');
const {
  setupSessionStorage,
  mockApiResponse,
  MOCK_STUDENT,
  MOCK_BOOK,
  MOCK_SESSION,
} = require('./helpers');

// Session URL used throughout this spec
const SESSION_URL = `/session?bookId=${MOCK_BOOK.id}&bookTitle=${encodeURIComponent(MOCK_BOOK.title)}`;

test.describe('Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the session start endpoint — returns a session id
    await mockApiResponse(page, /\/api\/sessions\/start/, {
      session: { id: MOCK_SESSION.id },
      sessionId: MOCK_SESSION.id,
    });

    // Mock the message endpoint — returns a follow-up question
    await mockApiResponse(page, /\/api\/sessions\/.*\/message/, {
      reply: {
        content: "That's interesting! Can you tell me more about why you feel that way?",
      },
      vocabulary: [],
      grammarScore: 80,
    });

    // Mock the pause/complete endpoints so they don't throw
    await mockApiResponse(page, /\/api\/sessions\/.*\/pause/, { ok: true });
    await mockApiResponse(page, /\/api\/sessions\/.*\/complete/, {
      summary: { duration: 300, turns: 4, levelScore: 75, grammarScore: 80 },
    });

    // Seed sessionStorage after landing on origin
    await page.goto('/');
    await setupSessionStorage(page, {
      studentId: MOCK_STUDENT.id,
      studentName: MOCK_STUDENT.name,
      // Intermediate → text input visible by default, not beginner-mode
      studentLevel: 'Intermediate',
      studentAge: MOCK_STUDENT.age,
      bookId: String(MOCK_BOOK.id),
      bookTitle: MOCK_BOOK.title,
      sessionId: MOCK_SESSION.id,
      authToken: 'demo-token',
    });

    await page.goto(SESSION_URL);
  });

  test('session page loads and shows the worksheet panel', async ({ page }) => {
    // Left worksheet panel has header "Reading Worksheet"
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });
  });

  test('worksheet panel contains all 6 stage labels', async ({ page }) => {
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });

    // 6 stages: Warm-Up, Title, Introduction, Body (×3 rows), Conclusion, Reflection
    await expect(page.getByText('Warm-Up')).toBeVisible();
    await expect(page.getByText('Title')).toBeVisible();
    await expect(page.getByText('Introduction')).toBeVisible();
    await expect(page.getByText('Conclusion')).toBeVisible();
    await expect(page.getByText('Reflection')).toBeVisible();
    // "Body" appears as Body ①, Body ②, Body ③ — just verify one exists
    await expect(page.getByText(/Body/)).toBeVisible();
  });

  test("AI's opening question is displayed in the chat", async ({ page }) => {
    // The initial message always contains the book title
    await expect(
      page.getByText(new RegExp(MOCK_BOOK.title, 'i'))
    ).toBeVisible({ timeout: 10_000 });

    // Alice avatar is shown (green circle with "A")
    await expect(page.locator('span:text("A")').first()).toBeVisible();
  });

  test('text input area is visible for Intermediate students', async ({ page }) => {
    // For non-beginner students, the text input should be immediately visible
    const textInput = page.locator('input[type="text"]').filter({
      hasNot: page.locator('[data-hidden]'),
    });
    await expect(textInput.first()).toBeVisible({ timeout: 10_000 });
    await expect(textInput.first()).not.toBeDisabled();
  });

  test('typing a response and pressing Enter submits the message', async ({ page }) => {
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 10_000 });

    const studentResponse = 'I think the caterpillar represents growth and change.';
    await textInput.fill(studentResponse);
    await textInput.press('Enter');

    // Student message appears in the chat
    await expect(page.getByText(studentResponse)).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Send button submits the student response', async ({ page }) => {
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 10_000 });

    await textInput.fill('The title makes me think about transformation.');

    const sendButton = page.getByRole('button', { name: /Send/i });
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    await expect(
      page.getByText('The title makes me think about transformation.')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('AI responds after student submits a message', async ({ page }) => {
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 10_000 });

    await textInput.fill('The caterpillar becomes a butterfly.');
    await textInput.press('Enter');

    // Wait for AI to respond — either the mocked reply or a mock fallback
    // Both contain a question mark or encouraging phrase
    await expect(
      page.locator('.bg-\\[\\#D6E9D6\\]').nth(1)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('voice button is rendered with correct ARIA label', async ({ page }) => {
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });

    // VoiceButton renders aria-label="Start listening" when not active
    const voiceButton = page.getByRole('button', { name: /Start listening/i });
    await expect(voiceButton).toBeVisible();
  });

  test('stage progress indicator is visible in the input area', async ({ page }) => {
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });

    // The stage label + turn counter are shown above the input
    await expect(page.getByText(/Warm-Up Stage|Title Stage|Introduction Stage|Body Stage|Conclusion Stage|Reflection Stage/)).toBeVisible();
    await expect(page.getByText(/Turn \d+\/3/)).toBeVisible();
  });

  test('Save & Exit button is present in the session toolbar', async ({ page }) => {
    await expect(page.getByText('Reading Worksheet')).toBeVisible({ timeout: 10_000 });

    const exitButton = page.getByRole('button', { name: /Save.*Exit/i });
    await expect(exitButton).toBeVisible();
    await expect(exitButton).toHaveAttribute('aria-label', 'Save and exit session');
  });
});
