# Hi Alice Launch Checklist

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Infrastructure

### Hosting and Database
- [ ] Supabase project provisioned (production tier)
- [ ] Database migrations applied (`supabase db push`)
- [ ] Row Level Security (RLS) policies enabled on all tables
- [ ] Supabase Storage bucket created for session images
- [ ] Domain registered and DNS configured
- [ ] SSL/TLS certificate active (auto-renew enabled)
- [ ] CDN configured for static assets (images, fonts, JS bundles)
- [ ] Backend API server deployed (Node.js / Express)
- [ ] Health check endpoints responding: `GET /health`, `GET /health/db`

### Environment Variables (Backend)
- [ ] `ANTHROPIC_API_KEY` set (Claude Sonnet 4 — HiAlice AI engine)
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_KEY` set (backend only, never exposed to client)
- [ ] `JWT_SECRET` changed from default (`hialice-secret-change-in-prod`)
- [ ] `OPENAI_API_KEY` set (Whisper STT + DALL-E 3 image generation)
- [ ] `ELEVENLABS_API_KEY` set (TTS voice synthesis)
- [ ] `SENTRY_DSN` set (backend error tracking)

### Environment Variables (Frontend / Next.js)
- [ ] `NEXT_PUBLIC_API_URL` points to production backend
- [ ] `NEXT_PUBLIC_SENTRY_DSN` set (frontend error tracking)
- [ ] No `NEXT_PUBLIC_` prefixed secrets (never expose service keys)

---

## 2. Security

### Authentication and Authorization
- [ ] JWT tokens are httpOnly cookies (not localStorage) in production
- [ ] Token expiry configured (recommended: 24h access, 30d refresh)
- [ ] Role-based access control verified for all routes:
  - [ ] `/admin` — admin, super_admin only
  - [ ] `/teacher` — teacher, admin, super_admin, parent only
  - [ ] `/parent` — parent, admin only
  - [ ] `/session` — student only
- [ ] Unauthenticated access to protected routes redirects to `/`

### COPPA Compliance (Children's Privacy)
- [ ] Consent page (`/consent`) requires parent/guardian checkbox agreement
- [ ] Consent is recorded with timestamp and guardian name before child account activation
- [ ] Privacy Policy page (`/privacy-policy`) is live and accurate
- [ ] Data request page (`/data-request`) allows COPPA data deletion requests
- [ ] No collection of personal child data without verified parental consent
- [ ] Child accounts cannot be created via self-registration (parent flow required)

### API Security
- [ ] Rate limiting enabled on all auth endpoints:
  - [ ] `POST /api/auth/login` — max 10 req/min per IP
  - [ ] `POST /api/auth/register` — max 5 req/min per IP
  - [ ] `POST /api/ai/chat` — max 20 req/min per user
- [ ] CORS configured: allow only the production frontend origin
- [ ] Input validation on all request bodies (schema-based, fail fast)
- [ ] SQL injection protection via parameterized queries (Supabase client handles this)
- [ ] Content Security Policy (CSP) headers set on all HTML responses
- [ ] `X-Frame-Options: DENY` header set (clickjacking prevention)
- [ ] Sensitive error details stripped from API responses in production

### Content Filter (Child Safety)
- [ ] `sanitize.js` content filter active on all AI responses
- [ ] Age-appropriate content rules enforced before responses are sent to the client
- [ ] Inappropriate content triggers graceful fallback (no raw error exposure)

### Secrets Audit
- [ ] No API keys hardcoded in any source file
- [ ] No secrets committed to git history (run `git log -S "sk-" --all`)
- [ ] `.env` files are in `.gitignore`
- [ ] `NEXT_PUBLIC_` environment variables contain no sensitive data

---

## 3. Quality

### Build Verification
- [ ] `npm run build` passes with zero errors (Next.js frontend)
- [ ] `npm run build` passes with zero errors (backend)
- [ ] No TypeScript / ESLint errors blocking build

### Test Suites
- [ ] Unit/integration tests pass: `npm run test` (Vitest)
- [ ] E2E tests pass: `npm run test:e2e` (Playwright — requires running server)
  - [ ] 01 — Login and Student Selection
  - [ ] 02 — Book Selection
  - [ ] 03 — Session Flow
  - [ ] 04 — Session Complete
  - [ ] 05 — Vocabulary
  - [ ] 06 — Profile
  - [ ] 07 — Parent Dashboard
  - [ ] 08 — COPPA Consent
  - [ ] 09 — Admin Dashboard
  - [ ] 10 — Admin Students
  - [ ] 11 — Admin Books
  - [ ] 12 — Admin Prompts
  - [ ] 13 — Navigation Offline
  - [ ] 14 — Accessibility
  - [ ] 15 — Child UX Validation
  - [ ] 16 — Teacher Dashboard (new)
  - [ ] 17 — Security Audit (new)
  - [ ] 18 — Launch Readiness (new)
- [ ] E2E test pass rate >= 95%
- [ ] No console errors on critical pages (home, login, books, session, review)

### Mobile and Responsive
- [ ] No horizontal scroll at 375px viewport width (iPhone SE / 12)
- [ ] No horizontal scroll at 768px viewport width (iPad)
- [ ] Touch targets minimum 48px (64px for Beginner level students)
- [ ] Pinch-zoom not blocked (do not use `user-scalable=no`)

---

## 4. Education — Core Learning Flow

### Session Flow (4-Stage T.E.A.A. Structure)
- [ ] Stage 1 Title: AI opens with title exploration question
- [ ] Stage 2 Introduction: character and setting comprehension
- [ ] Stage 3 Body: 3-reason structure with THINK/EXPLAIN/ADD prompts
- [ ] Stage 4 Conclusion: personal reflection and recommendation
- [ ] Stage transition fires `AchieveOverlay` with growth mindset message
- [ ] Session completion navigates to `/review` automatically

### Level Adaptation
- [ ] Beginner (6-8): 4 Bloom stages, 64px touch targets, voice-first input
- [ ] Intermediate (9-11): 5 Bloom stages, 52px touch targets, balanced input
- [ ] Advanced (12-13): 6 Bloom stages, 48px touch targets, text-first input
- [ ] `featureGates.js` FEATURE_GATES enforces correct nav item count per level

### Vocabulary (Krashen i+1)
- [ ] `VocabSidebar` surfaces i+1 vocabulary during active session
- [ ] New words are saved to `Vocabulary` table post-session
- [ ] `/vocabulary` page displays learned words with mastery levels
- [ ] Spaced repetition: due-today words surfaced on vocabulary page

### AI Engine (HiAlice)
- [ ] Claude Sonnet 4 model connected via `ANTHROPIC_API_KEY`
- [ ] System prompt enforces Socratic method (no direct answers)
- [ ] Growth mindset language validated (no "wrong", "incorrect")
- [ ] Short answer detection triggers gentle follow-up prompts
- [ ] Cost tracking (`costTracker.js`) is active and logging per-session spend

---

## 5. UX — Critical User Flows

### Login and Student Selection
- [ ] Parent email + password login works end-to-end
- [ ] Child card tap sets student session and navigates to `/books`
- [ ] Demo Mode button works for unauthenticated preview
- [ ] "Parent Login" button shows form; "Back" returns to child selection
- [ ] Login form validation shows error on empty submit

### Book Library
- [ ] Books load and display with title, author, level badge, cover emoji
- [ ] Search/filter by title works
- [ ] Level filter shows only age-appropriate books
- [ ] Tapping a book navigates to `/session?bookId=...`

### AI Session
- [ ] Session loads the selected book context
- [ ] HiAlice opens with the Title stage question
- [ ] Voice input (microphone button) is prominent and functional in Chrome/Safari
- [ ] Text input fallback available on all platforms
- [ ] Turn counter displays "Turn 1/3" (or Beginner emoji equivalent)
- [ ] Session timer milestone (15 min) shows encouragement overlay
- [ ] `ConfettiCelebration` fires on session completion

### Review and Worksheet
- [ ] `/review` page loads session summary (grammar score, level score)
- [ ] Vocabulary word cards displayed with synonyms and context sentences
- [ ] Worksheet is printable (print CSS styles applied)

### Parent Dashboard
- [ ] `/parent` requires parent token — redirects to `/` otherwise
- [ ] Child analytics displayed: books read, words learned, streak
- [ ] Growth Radar (7-dimension) renders correctly

### Teacher Dashboard
- [ ] `/teacher` requires teacher/admin/parent role
- [ ] 3 class tabs (Morning, Afternoon, Saturday) switch student roster
- [ ] Student cards expand to show AI feedback, recent sessions, vocabulary
- [ ] Export Report button triggers download/status feedback
- [ ] Assign Book modal opens, allows selection, and confirms assignment

---

## 6. Monitoring and Observability

- [ ] Sentry error tracking active in production (backend + frontend)
- [ ] Sentry source maps uploaded for readable stack traces
- [ ] Admin monitoring dashboard (`/admin`) accessible to admin role
- [ ] Cost tracking dashboard shows per-session AI spend
- [ ] Backend logs: all API errors logged with request context
- [ ] Uptime monitoring configured (recommend: UptimeRobot or Better Uptime)
- [ ] Alert configured for: error rate > 5%, latency > 3s, DB connection failures

---

## 7. Final Pre-Launch Checklist

### 24 Hours Before Launch
- [ ] Full E2E test suite passes on production build
- [ ] Load test completed: simulate 50 concurrent users on `/api/ai/chat`
- [ ] Database backup configured (daily automated backups)
- [ ] Rollback plan documented (previous deployment tag identified)
- [ ] Support email or contact form configured for parent inquiries

### Launch Day
- [ ] DNS TTL reduced to 300s (5 min) before cutover
- [ ] Production environment variables double-checked against this checklist
- [ ] Health check endpoints verified: `GET /health` returns 200
- [ ] Smoke test: complete one full session from login to review in production
- [ ] Sentry dashboard open and monitored during launch window

### Post-Launch (First 48 Hours)
- [ ] Monitor Sentry for error spikes
- [ ] Review cost tracking for unexpected AI spend
- [ ] Check database connection pool utilization
- [ ] Gather initial user feedback from beta testers
- [ ] Verify parental consent records are being saved correctly
```

---

*HiAlice Launch Checklist — v1.0 | 2026-03-15*
