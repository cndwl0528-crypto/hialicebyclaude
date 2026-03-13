/**
 * emailService.js
 * HiAlice — Lightweight Email Notification Service
 *
 * Uses nodemailer with configurable SMTP transport.
 * If SMTP is not configured (env vars missing), logs a warning and silently skips.
 *
 * Environment variables:
 *   SMTP_HOST   — SMTP server hostname (e.g., smtp.gmail.com)
 *   SMTP_PORT   — SMTP server port (default: 587)
 *   SMTP_USER   — SMTP username / email
 *   SMTP_PASS   — SMTP password / app password
 *   SMTP_FROM   — Sender address (default: SMTP_USER)
 */

let transporter = null;
let smtpConfigured = false;
let initPromise = null;

/**
 * Lazily initialise nodemailer transport.
 * Returns true if SMTP is configured and transport is ready.
 */
async function ensureTransport() {
  // Already initialised (or failed)
  if (transporter !== null) return smtpConfigured;

  // Avoid concurrent init
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn(
        '[EmailService] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required). ' +
        'Email notifications will be skipped.'
      );
      transporter = false; // sentinel: initialised but disabled
      smtpConfigured = false;
      return false;
    }

    try {
      const nodemailer = await import('nodemailer');
      const createTransport = nodemailer.default?.createTransport || nodemailer.createTransport;

      transporter = createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      smtpConfigured = true;
      console.log(`[EmailService] SMTP transport ready (${host}:${port})`);
      return true;
    } catch (err) {
      console.warn(
        '[EmailService] nodemailer package not found. Run: npm install nodemailer. ' +
        'Email notifications will be skipped.',
        err.message
      );
      transporter = false;
      smtpConfigured = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Send a session completion report email to a parent.
 *
 * @param {string} parentEmail — Recipient email address
 * @param {Object} sessionData — Session summary data
 * @param {string} sessionData.studentName
 * @param {string} sessionData.bookTitle
 * @param {number} sessionData.grammarScore
 * @param {number} sessionData.levelScore
 * @param {number} sessionData.vocabularyCount
 * @param {string} [sessionData.aiFeedback]
 * @param {string} [sessionData.completedAt]
 * @returns {Promise<boolean>} true if sent, false if skipped
 */
export async function sendSessionReport(parentEmail, sessionData) {
  const ready = await ensureTransport();
  if (!ready) {
    console.log('[EmailService] Skipping email — SMTP not configured');
    return false;
  }

  if (!parentEmail) {
    console.warn('[EmailService] No parent email provided — skipping');
    return false;
  }

  const {
    studentName = 'Student',
    bookTitle = 'a book',
    grammarScore = 0,
    levelScore = 0,
    vocabularyCount = 0,
    aiFeedback = '',
    completedAt = new Date().toISOString(),
  } = sessionData;

  // Escape user-controlled values to prevent HTML injection in emails
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const safeStudentName = esc(studentName);
  const safeBookTitle = esc(bookTitle);
  const safeAiFeedback = esc(aiFeedback);

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
  const dateStr = new Date(completedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `HiAlice: ${safeStudentName} completed a reading session!`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #5C8B5C, #3D6B3D); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">HiAlice Session Report</h1>
        <p style="color: #C8E6C9; margin: 8px 0 0 0;">Great news about ${safeStudentName}!</p>
      </div>

      <div style="background: #FFFCF3; border: 1px solid #E8DEC8; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <h2 style="color: #3D2E1E; margin: 0 0 12px 0; font-size: 18px;">Session Summary</h2>
        <p style="color: #6B5744; margin: 4px 0;"><strong>Student:</strong> ${safeStudentName}</p>
        <p style="color: #6B5744; margin: 4px 0;"><strong>Book:</strong> ${safeBookTitle}</p>
        <p style="color: #6B5744; margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1; background: #E8F5E8; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #3D6B3D; font-size: 28px; font-weight: bold; margin: 0;">${grammarScore}%</p>
          <p style="color: #5C8B5C; font-size: 12px; margin: 4px 0 0 0;">Grammar Score</p>
        </div>
        <div style="flex: 1; background: #FFF8E1; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #B8903A; font-size: 28px; font-weight: bold; margin: 0;">${levelScore}%</p>
          <p style="color: #D4A843; font-size: 12px; margin: 4px 0 0 0;">Completion Score</p>
        </div>
        <div style="flex: 1; background: #E0F4F9; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #2A7A8C; font-size: 28px; font-weight: bold; margin: 0;">${vocabularyCount}</p>
          <p style="color: #5BA8B8; font-size: 12px; margin: 4px 0 0 0;">New Words</p>
        </div>
      </div>

      ${aiFeedback ? `
      <div style="background: #F5F0E8; border-radius: 12px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #5C8B5C;">
        <p style="color: #6B5744; font-size: 14px; font-style: italic; margin: 0;">"${safeAiFeedback}"</p>
        <p style="color: #9B8777; font-size: 12px; margin: 8px 0 0 0;">-- HiAlice</p>
      </div>
      ` : ''}

      <div style="text-align: center; padding: 16px; color: #9B8777; font-size: 12px;">
        <p>Keep encouraging ${safeStudentName} to read and explore!</p>
        <p style="margin-top: 8px;">HiAlice -- AI English Reading Companion</p>
      </div>
    </div>
  `;

  const text = [
    `HiAlice Session Report`,
    ``,
    `${studentName} just completed a reading session!`,
    `Book: ${bookTitle}`,
    `Date: ${dateStr}`,
    `Grammar Score: ${grammarScore}%`,
    `Completion Score: ${levelScore}%`,
    `New Words: ${vocabularyCount}`,
    aiFeedback ? `\nHiAlice says: "${aiFeedback}"` : '',
    ``,
    `Keep encouraging ${studentName} to read and explore!`,
    `-- HiAlice`,
  ].join('\n');

  try {
    await transporter.sendMail({
      from: `"HiAlice" <${fromAddr}>`,
      to: parentEmail,
      subject,
      text,
      html,
    });
    console.log(`[EmailService] Session report sent to ${parentEmail}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${parentEmail}:`, err.message);
    return false;
  }
}

/**
 * Send a generic notification email.
 *
 * @param {string} to — Recipient email
 * @param {string} subject — Email subject
 * @param {string} htmlBody — HTML email body
 * @returns {Promise<boolean>}
 */
export async function sendEmail(to, subject, htmlBody) {
  const ready = await ensureTransport();
  if (!ready) return false;
  if (!to) return false;

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from: `"HiAlice" <${fromAddr}>`,
      to,
      subject,
      html: htmlBody,
    });
    console.log(`[EmailService] Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    return false;
  }
}
