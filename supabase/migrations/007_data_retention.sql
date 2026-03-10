-- Data Retention Policy — COPPA compliance
-- Migration 007: Auto-redact dialogue content after 90 days
-- Preserves metadata (scores, stages, timestamps) but removes raw conversation text

-- ---------------------------------------------------------------------------
-- 1. Function: redact_old_dialogue_content
-- Replaces dialogue content older than 90 days with '[redacted]'
-- while preserving all metadata (stage, turn, speaker, grammar_score, etc.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION redact_old_dialogue_content()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE dialogues
  SET content = '[redacted — data retention policy]'
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND content != '[redacted — data retention policy]'
    AND speaker = 'student';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- Log the operation
  INSERT INTO consent_audit_log (
    parent_email,
    parent_name,
    consent_given,
    consent_timestamp,
    consent_version,
    ip_address,
    user_agent
  ) VALUES (
    'system@hialice.app',
    'Data Retention System',
    true,
    NOW(),
    'retention-policy-v1',
    'server',
    'pg_cron/data_retention'
  );

  RAISE NOTICE 'Redacted % dialogue rows older than 90 days', affected_rows;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Function: cleanup_old_cognitive_tags
-- Remove cognitive tag evidence text (but keep bloom_level) after 90 days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_old_cognitive_tags()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE dialogue_cognitive_tags
  SET evidence_text = NULL
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND evidence_text IS NOT NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Combined retention job function (for manual or cron execution)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_data_retention()
RETURNS TABLE(dialogues_redacted INTEGER, tags_cleaned INTEGER) AS $$
DECLARE
  d_count INTEGER;
  t_count INTEGER;
BEGIN
  SELECT redact_old_dialogue_content() INTO d_count;
  SELECT cleanup_old_cognitive_tags() INTO t_count;

  dialogues_redacted := d_count;
  tags_cleaned := t_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. Schedule with pg_cron (if extension available)
-- Runs daily at 3:00 AM UTC
-- Note: pg_cron must be enabled in Supabase dashboard under Database > Extensions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'hialice-data-retention',
      '0 3 * * *',
      'SELECT run_data_retention()'
    );
    RAISE NOTICE 'pg_cron job scheduled: hialice-data-retention (daily 3AM UTC)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Run SELECT run_data_retention() manually or set up an external cron job.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Index to speed up retention queries on dialogues.created_at
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dialogues_created_at
  ON dialogues(created_at)
  WHERE speaker = 'student';

-- ---------------------------------------------------------------------------
-- 6. Add retention_policy metadata column to sessions
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS content_redacted_at TIMESTAMPTZ;
