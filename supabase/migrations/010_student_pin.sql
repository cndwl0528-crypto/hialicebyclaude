-- ============================================================================
-- Migration 010: Add PIN column to students table
-- Allows children to log in with a 4-digit PIN
-- ============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- Also add service_role bypass to students INSERT policy
-- (needed for backend to insert children on behalf of parents)
DROP POLICY IF EXISTS "parents_can_create_students" ON students;
CREATE POLICY "students_insert_parent_or_service"
  ON students FOR INSERT
  WITH CHECK (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
    OR current_setting('role', true) = 'service_role'
  );
