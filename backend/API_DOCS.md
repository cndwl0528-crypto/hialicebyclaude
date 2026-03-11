# HiAlice Backend API Documentation

Base URL: `http://localhost:5000` (development) or configured via `PORT` env var.

All API routes are prefixed with `/api`. Authentication uses JWT tokens sent as httpOnly cookies (`hialice_token`) or via `Authorization: Bearer <token>` header.

---

## Health Checks

### GET /health
Basic health check. Unauthenticated.

**Response:**
```json
{ "status": "ok", "service": "hialice-backend", "timestamp": "ISO-8601", "uptime": 123.45 }
```

### GET /health/db
Database connectivity check. Unauthenticated.

**Response (200):**
```json
{ "status": "ok", "database": "connected", "latencyMs": 12, "timestamp": "ISO-8601" }
```

**Response (503):**
```json
{ "status": "error", "database": "unreachable", "error": "...", "timestamp": "ISO-8601" }
```

---

## Auth Routes (`/api/auth`)

### POST /api/auth/parent-login
Email + password login via Supabase Auth. Rate-limited.

**Body:** `{ "email": "string", "password": "string" }`

**Response (200):**
```json
{
  "token": "jwt-string",
  "parent": { "id": "uuid", "email": "string", "display_name": "string" },
  "children": [{ "id": "uuid", "name": "string", "age": 8, "level": "beginner", ... }]
}
```

### POST /api/auth/child-select
Select a child for a reading session. Issues a student-scoped JWT.

**Auth:** Parent token required.

**Body:** `{ "studentId": "uuid" }`

**Response (200):**
```json
{
  "token": "jwt-string",
  "student": { "id": "uuid", "name": "string", "age": 8, "level": "beginner", ... }
}
```

### POST /api/auth/refresh
Refresh the current JWT with a fresh 24h expiry.

**Auth:** Valid token required.

**Response (200):**
```json
{ "token": "jwt-string", "expiresIn": 86400 }
```

### POST /api/auth/logout
Log out and clear the auth cookie. Best-effort Supabase signOut.

**Auth:** Valid token required.

**Response (200):**
```json
{ "success": true, "message": "Logged out successfully. Please clear your client token." }
```

### GET /api/auth/me
Get current user info from JWT.

**Auth:** Valid token required.

**Response (200) — Parent:**
```json
{
  "user": { "type": "parent", "id": "uuid", "email": "string", "display_name": "string", ... },
  "children": [...]
}
```

**Response (200) — Student:**
```json
{
  "user": { "type": "student", "id": "uuid", "name": "string", "age": 8, "level": "beginner", ... }
}
```

### GET /api/auth/notifications
Get parent notification inbox (most recent 50).

**Auth:** Parent token required.

**Query:** `?unreadOnly=true` (optional)

**Response (200):**
```json
{
  "notifications": [{ "id": "uuid", "studentId": "uuid", "type": "session_complete", "title": "string", "message": "string", "isRead": false, "createdAt": "ISO-8601" }],
  "unreadCount": 3
}
```

### PUT /api/auth/notifications/:id/read
Mark a notification as read. Use `id=all` to mark all as read.

**Auth:** Parent token required.

**Response (200):**
```json
{ "success": true }
```

### POST /api/auth/consent
Record verifiable parental consent (COPPA). Unauthenticated.

**Body:** `{ "parentEmail": "string", "parentName": "string", "consentGiven": true, "consentTimestamp": "ISO-8601", "consentVersion": "1.0" }`

**Response (200):**
```json
{ "success": true, "message": "Consent recorded successfully", "consentDate": "ISO-8601" }
```

---

## Session Routes (`/api/sessions`)

### POST /api/sessions/start
Start a new Q&A reading session.

**Auth:** Student token required (dev: optional).

**Body:** `{ "studentId": "uuid", "bookId": "uuid" }`

**Response (200):**
```json
{ "session": { "id": "uuid", "stage": "title", ... }, "aliceMessage": "string" }
```

### POST /api/sessions/:id/message
Send a student message and receive Alice's reply.

**Auth:** Student token required (dev: optional).

**Body:** `{ "content": "string", "studentId": "uuid" }`

**Response (200):**
```json
{
  "aliceMessage": "string",
  "stage": "introduction",
  "grammarScore": 82,
  "newVocabulary": [...],
  "sessionComplete": false
}
```

### POST /api/sessions/:id/complete
Complete a session. Saves stage scores and awards badges.

**Auth:** Student token required (dev: optional).

**Body:** `{ "studentId": "uuid" }`

**Response (200):**
```json
{
  "session": { ... },
  "feedback": { ... },
  "achievements": [...]
}
```

### GET /api/sessions/:id/review
Full session review with dialogues and vocabulary.

**Auth:** Token required (dev: optional).

**Response (200):**
```json
{
  "session": { ... },
  "dialogues": [...],
  "vocabulary": [...],
  "stageScores": [...]
}
```

### GET /api/sessions/student/:studentId
Session history for a student.

**Auth:** Token required (dev: optional).

**Response (200):**
```json
{ "sessions": [...] }
```

### GET /api/sessions/:id/stage-scores
Per-stage scores for a single session.

**Auth:** Token required (dev: optional).

**Response (200):**
```json
{ "stageScores": [{ "stage": "title", "grammarScore": 85, "wordCount": 12, ... }] }
```

### PUT /api/sessions/:id/pause
Pause (save-and-exit) a session.

**Auth:** Token required (dev: optional).

**Response (200):**
```json
{ "session": { "status": "paused", ... } }
```

### PUT /api/sessions/:id/resume
Resume a paused session.

**Auth:** Token required (dev: optional).

**Response (200):**
```json
{ "session": { "status": "active", ... }, "aliceMessage": "string" }
```

---

## Book Routes (`/api/books`)

### GET /api/books
List all books with optional level filter.

**Auth:** None required.

**Query:** `?level=beginner` (optional)

**Response (200):**
```json
{ "books": [{ "id": "uuid", "title": "string", "author": "string", "level": "beginner", "genre": "string", "cover_emoji": "string", "description": "string" }] }
```

### GET /api/books/recommendations/:studentId
Level-appropriate book recommendations (excludes completed books).

**Auth:** Token required.

**Response (200):**
```json
{ "recommendations": [...], "studentLevel": "beginner" }
```

### GET /api/books/:id
Get a single book by ID.

**Auth:** None required.

**Response (200):**
```json
{ "book": { "id": "uuid", "title": "string", ... } }
```

---

## Vocabulary Routes (`/api/vocabulary`)

### GET /api/vocabulary/:studentId
All vocabulary for a student.

**Auth:** Token required.

**Query:** `?sessionId=uuid` (optional, filter by session)

**Response (200):**
```json
{
  "vocabulary": [{ "id": "uuid", "word": "string", "context_sentence": "string", "synonyms": [...], "pos": "noun", "mastery_level": 3, ... }],
  "stats": { "totalWords": 42, "newThisWeek": 5, "avgMastery": 3 }
}
```

### GET /api/vocabulary/:studentId/due-today
Words due for spaced repetition review today.

**Auth:** Token required.

**Response (200):**
```json
{ "words": [...], "count": 8 }
```

### POST /api/vocabulary/:studentId/practice-result
Record a spaced repetition practice attempt.

**Auth:** Token required.

**Body:** `{ "vocabularyId": "uuid", "isCorrect": true, "responseTimeMs": 1200 }`

**Response (200):**
```json
{ "log": { ... }, "vocabulary": { ... }, "nextReviewAt": "ISO-8601", "intervalDays": 4 }
```

### GET /api/vocabulary/:studentId/stats
Enriched vocabulary statistics.

**Auth:** Token required.

**Response (200):**
```json
{
  "stats": { "totalWords": 42, "masteredWords": 12, "learningWords": 30, "dueToday": 5, "byLevel": { "0": 2, "1": 8, ... }, "weeklyGrowth": [{ "week": "2026-10", "count": 5 }] }
}
```

### GET /api/vocabulary/:studentId/practice
Get words due for practice (legacy endpoint).

**Auth:** Token required.

**Response (200):**
```json
{ "words": [...], "stats": { "dueCount": 3, "reviewCount": 2, "totalPractice": 5 } }
```

### POST /api/vocabulary/:studentId/practice
Submit practice result (legacy endpoint).

**Auth:** Token required.

**Body:** `{ "wordId": "uuid", "correct": true }`

**Response (200):**
```json
{ "vocabulary": { ... }, "nextWord": { ... }, "masteryLevel": 3 }
```

### PUT /api/vocabulary/:id/mastery
Manually set mastery level for a vocabulary word.

**Auth:** Token required.

**Body:** `{ "masteryLevel": 4 }` (0-5)

**Response (200):**
```json
{ "vocabulary": { ... } }
```

---

## TTS Routes (`/api/tts`)

### POST /api/tts/speak
Text-to-speech proxy. Keeps the ElevenLabs API key server-side.

**Auth:** None required.

**Body:** `{ "text": "Hello world", "voiceId": "optional-voice-id" }`

**Response (200):** Audio stream (`Content-Type: audio/mpeg`)

**Limits:** Max 1000 characters.

---

## COPPA Routes (`/api/coppa`)

### POST /api/coppa/verify-intent
Create a Stripe PaymentIntent for COPPA Verifiable Parental Consent ($0.50).

**Auth:** None required.

**Body:** `{ "parentEmail": "string", "parentName": "string" }`

**Response (200):**
```json
{ "clientSecret": "string", "paymentIntentId": "string" }
```

### POST /api/coppa/verify-confirm
Confirm VPC payment succeeded. Records consent and issues automatic refund.

**Auth:** None required.

**Body:** `{ "paymentIntentId": "string", "parentEmail": "string", "parentName": "string" }`

**Response (200):**
```json
{ "verified": true, "refundId": "string" }
```

### GET /api/coppa/status/:email
Check VPC status for a parent email.

**Auth:** None required.

**Response (200):**
```json
{ "verified": true, "consentDate": "ISO-8601", "consentVersion": "2.0-vpc" }
```

---

## Admin Routes (`/api/admin`)

All admin routes require admin/super_admin role (skipped in development).

### GET /api/admin/dashboard
Overview dashboard with student count, session stats, and recent activity.

**Response (200):**
```json
{ "totalStudents": 12, "totalSessions": 89, "sessionsThisWeek": 15, ... }
```

### GET /api/admin/students
List all students with stats.

**Response (200):**
```json
{ "students": [{ "id": "uuid", "name": "string", "age": 8, "level": "beginner", "stats": { ... } }] }
```

### GET /api/admin/students/:id
Get a single student with detailed stats and achievements.

**Response (200):**
```json
{ "student": { ... }, "stats": { ... }, "achievements": [...] }
```

### POST /api/admin/students
Create a new student.

**Body:** `{ "name": "string", "age": 8, "level": "beginner", "parentId": "uuid" }`

### PUT /api/admin/students/:id
Update a student.

**Body:** `{ "name": "string", "age": 9, "level": "intermediate", ... }`

### DELETE /api/admin/students/:id
Delete a student and all associated data.

### GET /api/admin/books
List all books (including inactive).

### POST /api/admin/books
Create a new book.

**Body:** `{ "title": "string", "author": "string", "level": "beginner", "genre": "string", "cover_emoji": "string", "description": "string" }`

### PUT /api/admin/books/:id
Update a book.

### DELETE /api/admin/books/:id
Delete a book (only if no sessions reference it).

### GET /api/admin/reports/student/:id
Detailed student report with session history and vocabulary growth.

### GET /api/admin/reports/overview
System-wide analytics overview.

### GET /api/admin/reports/export
Export report data.

**Query:** `?format=csv` (optional)

### GET /api/admin/prompts
Get current AI system prompt configuration.

### PUT /api/admin/prompts
Update AI system prompt configuration.

**Body:** `{ "systemPrompt": "string", ... }`

### GET /api/admin/students/:id/analytics
Detailed per-student analytics with session trends and vocabulary growth.

### POST /api/admin/prompts/test
Test an AI prompt configuration with a sample interaction.

**Body:** `{ "prompt": "string", "testMessage": "string" }`
