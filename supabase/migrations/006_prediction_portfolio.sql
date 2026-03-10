-- Prediction Portfolio — metacognitive prediction tracking for HiAlice
-- Migration 006: predictions table, verification, portfolio view

-- ---------------------------------------------------------------------------
-- 1. student_predictions — track predictions made during sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  book_id         UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  prediction_text TEXT        NOT NULL,
  prediction_type TEXT        NOT NULL
                  CHECK (prediction_type IN (
                    'plot',        -- What will happen next?
                    'character',   -- How will the character change?
                    'theme',       -- What is the book's message?
                    'ending',      -- How will it end?
                    'connection'   -- How does this connect to real life?
                  )),
  stage           TEXT        NOT NULL,
  was_correct     BOOLEAN,
  verification_text TEXT,
  verified_at     TIMESTAMPTZ,
  confidence_before SMALLINT  CHECK (confidence_before BETWEEN 1 AND 5),
  confidence_after  SMALLINT  CHECK (confidence_after BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_student
  ON student_predictions(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_session
  ON student_predictions(session_id);

-- ---------------------------------------------------------------------------
-- 2. Prediction accuracy view per student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW student_prediction_accuracy AS
SELECT
  student_id,
  COUNT(*) AS total_predictions,
  COUNT(*) FILTER (WHERE was_correct = true) AS correct_predictions,
  COUNT(*) FILTER (WHERE was_correct = false) AS incorrect_predictions,
  COUNT(*) FILTER (WHERE was_correct IS NULL) AS pending_predictions,
  ROUND(
    COUNT(*) FILTER (WHERE was_correct = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE was_correct IS NOT NULL), 0) * 100, 1
  ) AS accuracy_percentage,
  AVG(confidence_before) FILTER (WHERE confidence_before IS NOT NULL) AS avg_confidence_before,
  AVG(confidence_after) FILTER (WHERE confidence_after IS NOT NULL) AS avg_confidence_after
FROM student_predictions
GROUP BY student_id;

-- ---------------------------------------------------------------------------
-- 3. RLS for predictions table
-- ---------------------------------------------------------------------------
ALTER TABLE student_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on predictions"
  ON student_predictions FOR ALL
  USING (current_setting('role', true) = 'service_role');
