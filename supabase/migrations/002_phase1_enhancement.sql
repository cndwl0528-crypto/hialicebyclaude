-- ============================================================================
-- HiAlice Phase 1 Enhancement Migration
-- Project: HiAlice - Interactive English Reading App for Children (6-13)
-- Version: 2.0
-- Date: 2026-03-10
-- Depends on: 001_initial_schema.sql
-- ============================================================================
-- This migration adds:
--   1. session_stage_scores  — per-stage scoring breakdown
--   2. vocabulary_practice_log — spaced repetition history
--   3. student_achievements  — badges/gamification
--   4. student_goals         — weekly/daily goals tracking
--   5. parent_notifications  — in-app notification inbox
--   And extends existing tables with new columns.
-- ============================================================================

-- ============================================================================
-- 1. SESSION STAGE SCORES
-- ============================================================================
-- Stores granular per-stage scores for every completed session.
-- Enables radar-chart style breakdown (grammar / fluency / vocabulary per stage).

CREATE TABLE IF NOT EXISTS session_stage_scores (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id         UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  stage              TEXT NOT NULL CHECK (stage IN ('title', 'introduction', 'body', 'conclusion')),
  grammar_score      INTEGER CHECK (grammar_score BETWEEN 0 AND 100),
  fluency_score      INTEGER CHECK (fluency_score BETWEEN 0 AND 100),
  vocabulary_score   INTEGER CHECK (vocabulary_score BETWEEN 0 AND 100),
  response_count     INTEGER DEFAULT 0,
  avg_response_words INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_stage_scores_session
  ON session_stage_scores(session_id);

-- ============================================================================
-- 2. VOCABULARY PRACTICE LOG
-- ============================================================================
-- One row per practice attempt; enables SM-2-style spaced repetition.
-- next_review_at drives the "due today" queue.

CREATE TABLE IF NOT EXISTS vocabulary_practice_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id    UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  practiced_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_correct       BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  next_review_at   TIMESTAMPTZ,
  interval_days    INTEGER DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vocab_practice_student
  ON vocabulary_practice_log(student_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_vocab_practice_vocab
  ON vocabulary_practice_log(vocabulary_id);

-- ============================================================================
-- 3. STUDENT ACHIEVEMENTS
-- ============================================================================
-- Unique constraint on (student_id, achievement_key) prevents duplicate awards.

CREATE TABLE IF NOT EXISTS student_achievements (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id         UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  achievement_key    TEXT NOT NULL,
  achievement_label  TEXT NOT NULL,
  achievement_emoji  TEXT NOT NULL,
  earned_at          TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(student_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_student
  ON student_achievements(student_id);

-- ============================================================================
-- 4. STUDENT GOALS
-- ============================================================================
-- Tracks weekly_books / weekly_words / daily_streak targets.
-- week_start is NULL for streak goals (they are ongoing).

CREATE TABLE IF NOT EXISTS student_goals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  goal_type     TEXT NOT NULL CHECK (goal_type IN ('weekly_books', 'weekly_words', 'daily_streak')),
  target_value  INTEGER NOT NULL CHECK (target_value > 0),
  current_value INTEGER DEFAULT 0 NOT NULL,
  week_start    DATE,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_student
  ON student_goals(student_id);

-- ============================================================================
-- 5. PARENT NOTIFICATIONS
-- ============================================================================
-- In-app notification inbox for parents.
-- type options mirror significant app events.

CREATE TABLE IF NOT EXISTS parent_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id  UUID REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('session_complete', 'achievement', 'goal_reached', 'weekly_report')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_parent
  ON parent_notifications(parent_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON parent_notifications(parent_id, created_at DESC);

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- sessions: pause/resume support + boolean completion flag
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS paused_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumed_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_complete    BOOLEAN DEFAULT false;

-- vocabulary: link back to session + spaced repetition metadata
-- NOTE: session_id already exists in 001_initial_schema.sql.
--       The IF NOT EXISTS guards below are safe no-ops if columns exist.
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS last_practiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS practice_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_count     INTEGER DEFAULT 0;

-- students: aggregated stats columns for fast dashboard reads
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS total_books_read   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_words_learned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_session_date  DATE;

-- vocabulary: relax mastery_level lower bound from 1 → 0
--   Original constraint: mastery_level >= 1 AND mastery_level <= 5
--   New constraint:      mastery_level >= 0 AND mastery_level <= 5
--   (needed so spaced repetition can reset a word back to 0 on failure)
ALTER TABLE vocabulary
  DROP CONSTRAINT IF EXISTS mastery_level_range;

ALTER TABLE vocabulary
  ADD CONSTRAINT mastery_level_range
    CHECK (mastery_level >= 0 AND mastery_level <= 5);

-- ============================================================================
-- ROW LEVEL SECURITY — NEW TABLES
-- ============================================================================

ALTER TABLE session_stage_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_practice_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;

-- session_stage_scores: parents can view scores for their students' sessions
CREATE POLICY "parents_can_view_stage_scores"
  ON session_stage_scores FOR SELECT
  USING (session_id IN (
    SELECT id FROM sessions WHERE student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
  ));

-- vocabulary_practice_log: parents can view/insert practice logs for their students
CREATE POLICY "parents_can_view_practice_log"
  ON vocabulary_practice_log FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY "parents_can_insert_practice_log"
  ON vocabulary_practice_log FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- student_achievements: parents can view achievements
CREATE POLICY "parents_can_view_achievements"
  ON student_achievements FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- student_goals: parents can view and modify goals
CREATE POLICY "parents_can_view_goals"
  ON student_goals FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY "parents_can_manage_goals"
  ON student_goals FOR ALL
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- parent_notifications: parents can only view their own notifications
CREATE POLICY "parents_can_view_own_notifications"
  ON parent_notifications FOR SELECT
  USING (parent_id IN (
    SELECT id FROM parents WHERE auth_id = auth.uid()
  ));

CREATE POLICY "parents_can_update_own_notifications"
  ON parent_notifications FOR UPDATE
  USING (parent_id IN (
    SELECT id FROM parents WHERE auth_id = auth.uid()
  ));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Phase 1 enhancement tables and column extensions applied.
-- New capabilities: stage scoring, spaced repetition, achievements,
-- goals, and parent notifications.
