-- ============================================================================
-- HiAlice Phase — Bloom's Taxonomy Cognitive Tagging
-- Project: HiAlice - Interactive English Reading App for Children (6-13)
-- Version: 3.0
-- Date: 2026-03-10
-- Depends on: 002_phase1_enhancement.sql
-- ============================================================================
-- This migration adds:
--   1. dialogue_cognitive_tags — Bloom's taxonomy level per dialogue turn
--   2. session_cognitive_summary — aggregated view per session
--   3. "Thinking Momentum" score — tracks depth progression within a session
-- ============================================================================

-- ============================================================================
-- 1. DIALOGUE COGNITIVE TAGS
-- ============================================================================
-- One row per dialogue turn. Tags each student response with a Bloom's level
-- and stores the raw depth classification (surface / analytical / deep).
--
-- Bloom's Levels (1-6):
--   1 = Remember    — recall facts ("The character's name is...")
--   2 = Understand  — explain ideas ("The story is about...")
--   3 = Apply       — use in new context ("I would do the same because...")
--   4 = Analyze     — break down reasoning ("The reason this happened is...")
--   5 = Evaluate    — judge/justify ("I think this was wrong because...")
--   6 = Create      — generate new ideas ("If I wrote the ending, I would...")

CREATE TABLE IF NOT EXISTS dialogue_cognitive_tags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dialogue_id     UUID REFERENCES dialogues(id) ON DELETE CASCADE NOT NULL,
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,

  -- Bloom's taxonomy classification (1-6)
  blooms_level    INTEGER NOT NULL CHECK (blooms_level BETWEEN 1 AND 6),
  blooms_label    TEXT NOT NULL CHECK (blooms_label IN (
    'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
  )),

  -- Depth classification (surface / analytical / deep)
  depth_class     TEXT NOT NULL CHECK (depth_class IN ('surface', 'analytical', 'deep')),

  -- Linguistic evidence that triggered the classification
  evidence_markers TEXT[] DEFAULT '{}',

  -- Word count of the student response (for momentum calculation)
  word_count      INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- One tag per dialogue turn
  UNIQUE(dialogue_id)
);

CREATE INDEX IF NOT EXISTS idx_cognitive_tags_session
  ON dialogue_cognitive_tags(session_id);

CREATE INDEX IF NOT EXISTS idx_cognitive_tags_student
  ON dialogue_cognitive_tags(student_id);

CREATE INDEX IF NOT EXISTS idx_cognitive_tags_blooms
  ON dialogue_cognitive_tags(student_id, blooms_level);

-- ============================================================================
-- 2. SESSION COGNITIVE SUMMARY (Materialized view-style table)
-- ============================================================================
-- Aggregated per-session cognitive stats. Updated on session completion.
-- Avoids expensive aggregation queries on the dashboard.

CREATE TABLE IF NOT EXISTS session_cognitive_summary (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id            UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  student_id            UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,

  -- Distribution of Bloom's levels (count per level)
  remember_count        INTEGER DEFAULT 0,
  understand_count      INTEGER DEFAULT 0,
  apply_count           INTEGER DEFAULT 0,
  analyze_count         INTEGER DEFAULT 0,
  evaluate_count        INTEGER DEFAULT 0,
  create_count          INTEGER DEFAULT 0,

  -- Depth distribution
  surface_count         INTEGER DEFAULT 0,
  analytical_count      INTEGER DEFAULT 0,
  deep_count            INTEGER DEFAULT 0,

  -- Highest Bloom's level reached in the session
  peak_blooms_level     INTEGER DEFAULT 1 CHECK (peak_blooms_level BETWEEN 1 AND 6),

  -- Average Bloom's level (weighted)
  avg_blooms_level      NUMERIC(3,2) DEFAULT 1.00,

  -- Thinking Momentum Score: measures whether answers got DEEPER over time
  -- Positive = improving depth, Negative = declining, Zero = flat
  -- Calculated as: weighted slope of blooms_level over turn sequence
  thinking_momentum     NUMERIC(5,2) DEFAULT 0.00,

  -- Total student turns analyzed
  total_turns           INTEGER DEFAULT 0,

  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cognitive_summary_student
  ON session_cognitive_summary(student_id);

CREATE INDEX IF NOT EXISTS idx_cognitive_summary_momentum
  ON session_cognitive_summary(student_id, thinking_momentum DESC);

-- ============================================================================
-- 3. CROSS-SESSION VOCABULARY USAGE
-- ============================================================================
-- Tracks when a word learned in one session is used again in a different session.
-- Enables "Cross-Book Memory" analytics.

CREATE TABLE IF NOT EXISTS vocabulary_cross_session_usage (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vocabulary_id     UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  student_id        UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  used_in_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  used_at           TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Prevent duplicate entries for same word in same session
  UNIQUE(vocabulary_id, used_in_session_id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_cross_session_student
  ON vocabulary_cross_session_usage(student_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE dialogue_cognitive_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cognitive_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_cross_session_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parents_can_view_cognitive_tags"
  ON dialogue_cognitive_tags FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY "parents_can_view_cognitive_summary"
  ON session_cognitive_summary FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY "parents_can_view_cross_session_vocab"
  ON vocabulary_cross_session_usage FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id IN (
      SELECT id FROM parents WHERE auth_id = auth.uid()
    )
  ));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Bloom's taxonomy tagging, cognitive summaries, thinking momentum,
-- and cross-session vocabulary tracking are now available.
