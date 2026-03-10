-- Bloom's Taxonomy cognitive tagging for HiAlice
-- Migration 005: dialogue cognitive tags, student thinking patterns, dialogue extensions

-- ---------------------------------------------------------------------------
-- 1. dialogue_cognitive_tags — tag each student utterance with Bloom's level
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dialogue_cognitive_tags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id     UUID        NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
  bloom_level     TEXT        NOT NULL
                  CHECK (bloom_level IN (
                    'remember',
                    'understand',
                    'apply',
                    'analyze',
                    'evaluate',
                    'create'
                  )),
  evidence_text   TEXT,
  confidence      SMALLINT    CHECK (confidence BETWEEN 0 AND 100),
  tagged_by       TEXT        DEFAULT 'claude-sonnet-4',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cog_tags_dialogue ON dialogue_cognitive_tags(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_cog_tags_bloom    ON dialogue_cognitive_tags(bloom_level);

-- ---------------------------------------------------------------------------
-- 2. student_thinking_patterns — aggregated cognitive profile per student
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_thinking_patterns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  snapshot_date     DATE        NOT NULL,
  remember_ratio    NUMERIC(4,3) DEFAULT 0,
  understand_ratio  NUMERIC(4,3) DEFAULT 0,
  apply_ratio       NUMERIC(4,3) DEFAULT 0,
  analyze_ratio     NUMERIC(4,3) DEFAULT 0,
  evaluate_ratio    NUMERIC(4,3) DEFAULT 0,
  create_ratio      NUMERIC(4,3) DEFAULT 0,
  dominant_bloom    TEXT,
  thinking_range    NUMERIC(4,3),
  sessions_included INT         DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_thinking_student
  ON student_thinking_patterns(student_id, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- 3. Extend dialogues table with cognitive metadata
-- ---------------------------------------------------------------------------
ALTER TABLE dialogues
  ADD COLUMN IF NOT EXISTS response_time_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS edit_count        SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_count        SMALLINT,
  ADD COLUMN IF NOT EXISTS bloom_level       TEXT;

-- ---------------------------------------------------------------------------
-- 4. Extend sessions table with thinking momentum
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS thinking_momentum SMALLINT;

-- ---------------------------------------------------------------------------
-- 5. Cross-book vocabulary usage tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vocabulary_cross_session_usage (
  vocabulary_id   UUID        NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  used_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (vocabulary_id, session_id)
);

-- ---------------------------------------------------------------------------
-- 6. Extend vocabulary with next_review_at for accurate SR scheduling
-- ---------------------------------------------------------------------------
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 7. Weekly Bloom's distribution view (for parent/admin dashboards)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW student_bloom_weekly AS
SELECT
  s.student_id,
  DATE_TRUNC('week', s.completed_at) AS week,
  AVG(CASE WHEN dct.bloom_level IN ('analyze','evaluate','create') THEN 1.0 ELSE 0.0 END) AS higher_order_ratio,
  AVG(CASE WHEN dct.bloom_level IN ('remember','understand') THEN 1.0 ELSE 0.0 END) AS lower_order_ratio,
  COUNT(DISTINCT s.id) AS sessions_count
FROM sessions s
JOIN dialogues d ON d.session_id = s.id AND d.speaker = 'student'
JOIN dialogue_cognitive_tags dct ON dct.dialogue_id = d.id
WHERE s.is_complete = true
GROUP BY s.student_id, DATE_TRUNC('week', s.completed_at);

-- ---------------------------------------------------------------------------
-- 8. RLS for new tables
-- ---------------------------------------------------------------------------
ALTER TABLE dialogue_cognitive_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_thinking_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_cross_session_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cognitive tags"
  ON dialogue_cognitive_tags FOR ALL
  USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role full access on thinking patterns"
  ON student_thinking_patterns FOR ALL
  USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role full access on cross session vocab"
  ON vocabulary_cross_session_usage FOR ALL
  USING (current_setting('role', true) = 'service_role');
