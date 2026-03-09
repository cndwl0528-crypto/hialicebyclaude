-- COPPA Compliance additions
-- Migration 004: parental consent tracking, audit log, and RLS hardening

-- ---------------------------------------------------------------------------
-- Extend parents table with COPPA consent columns
-- ---------------------------------------------------------------------------
ALTER TABLE parents ADD COLUMN IF NOT EXISTS coppa_consent           BOOLEAN    DEFAULT FALSE;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS coppa_consent_date      TIMESTAMPTZ;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS coppa_consent_name      TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS coppa_consent_version   TEXT       DEFAULT '1.0';

-- ---------------------------------------------------------------------------
-- Consent audit log — append-only ledger of every consent action
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email      TEXT        NOT NULL,
  parent_name       TEXT        NOT NULL,
  consent_given     BOOLEAN     NOT NULL,
  consent_timestamp TIMESTAMPTZ NOT NULL,
  consent_version   TEXT        DEFAULT '1.0',
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS — rows are insert-only; updates and deletes are blocked
ALTER TABLE consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert consent logs"
  ON consent_audit_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "No consent log updates"
  ON consent_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY "No consent log deletes"
  ON consent_audit_log
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- RLS: parents may only read their own children's records
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students'
      AND policyname = 'Parents read own children'
  ) THEN
    CREATE POLICY "Parents read own children"
      ON students
      FOR SELECT
      USING (
        auth.uid() IN (SELECT id FROM parents WHERE id = students.parent_id)
        OR current_setting('role', true) = 'service_role'
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: students may only see sessions belonging to their parent's children
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions'
      AND policyname = 'Students read own sessions'
  ) THEN
    CREATE POLICY "Students read own sessions"
      ON sessions
      FOR SELECT
      USING (
        student_id IN (
          SELECT s.id FROM students s
          WHERE s.parent_id = auth.uid()
        )
        OR current_setting('role', true) = 'service_role'
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Input length constraints — defence-in-depth at the DB layer
-- ---------------------------------------------------------------------------
ALTER TABLE dialogues
  ADD CONSTRAINT IF NOT EXISTS content_max_length
  CHECK (length(content) <= 2000);

ALTER TABLE vocabulary
  ADD CONSTRAINT IF NOT EXISTS word_max_length
  CHECK (length(word) <= 100);
