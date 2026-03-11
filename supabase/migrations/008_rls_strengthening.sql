-- ============================================================================
-- Migration 008: RLS Policy Strengthening
-- Adds service_role bypass and admin access to core tables.
-- Ensures students, sessions, vocabulary, and parent_notifications
-- are only accessible by authorised users.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: check if a user has an admin role via a custom claim or app_metadata.
-- Supabase stores custom claims in auth.users -> raw_app_meta_data.
-- Returns true when the JWT role claim is 'admin' or 'super_admin'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json ->> 'role') IN ('admin', 'super_admin'),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STUDENTS: accessible by their parent or admin
-- ============================================================================

-- Drop the old overlapping policy from 004 if it exists
DROP POLICY IF EXISTS "Parents read own children" ON students;

-- SELECT: parent who owns the student, or admin, or service_role
CREATE POLICY "students_select_parent_or_admin"
  ON students FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- UPDATE: parent who owns the student, or admin, or service_role
DROP POLICY IF EXISTS "parents_can_update_own_students" ON students;
CREATE POLICY "students_update_parent_or_admin"
  ON students FOR UPDATE
  USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- DELETE: only admin or service_role
CREATE POLICY "students_delete_admin_only"
  ON students FOR DELETE
  USING (
    public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- ============================================================================
-- SESSIONS: accessible by the session's student's parent or admin
-- ============================================================================

-- Drop the overlapping policy from 004 if it exists
DROP POLICY IF EXISTS "Students read own sessions" ON sessions;

-- SELECT
DROP POLICY IF EXISTS "parents_can_view_student_sessions" ON sessions;
CREATE POLICY "sessions_select_parent_or_admin"
  ON sessions FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- UPDATE
DROP POLICY IF EXISTS "parents_can_update_student_sessions" ON sessions;
CREATE POLICY "sessions_update_parent_or_admin"
  ON sessions FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- INSERT: parent can create for their student, admin can create for any
DROP POLICY IF EXISTS "parents_can_create_sessions" ON sessions;
CREATE POLICY "sessions_insert_parent_or_admin"
  ON sessions FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- ============================================================================
-- VOCABULARY: accessible by the word's student's parent or admin
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "parents_can_view_student_vocabulary" ON vocabulary;
CREATE POLICY "vocabulary_select_parent_or_admin"
  ON vocabulary FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- INSERT
DROP POLICY IF EXISTS "parents_can_create_vocabulary" ON vocabulary;
CREATE POLICY "vocabulary_insert_parent_or_admin"
  ON vocabulary FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- UPDATE
CREATE POLICY "vocabulary_update_parent_or_admin"
  ON vocabulary FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id IN (
        SELECT id FROM parents WHERE auth_id = auth.uid()
      )
    )
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- DELETE: admin only
CREATE POLICY "vocabulary_delete_admin_only"
  ON vocabulary FOR DELETE
  USING (
    public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- ============================================================================
-- PARENT_NOTIFICATIONS: only accessible by the notification's parent
-- ============================================================================

-- SELECT (already exists from 002, but re-create for consistency with admin bypass)
DROP POLICY IF EXISTS "parents_can_view_own_notifications" ON parent_notifications;
CREATE POLICY "notifications_select_own_or_admin"
  ON parent_notifications FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- UPDATE (mark as read)
DROP POLICY IF EXISTS "parents_can_update_own_notifications" ON parent_notifications;
CREATE POLICY "notifications_update_own_or_admin"
  ON parent_notifications FOR UPDATE
  USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
    OR public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- INSERT: only service_role or admin (backend creates notifications)
CREATE POLICY "notifications_insert_service_only"
  ON parent_notifications FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );

-- DELETE: only admin or service_role
CREATE POLICY "notifications_delete_admin_only"
  ON parent_notifications FOR DELETE
  USING (
    public.is_admin()
    OR current_setting('role', true) = 'service_role'
  );
