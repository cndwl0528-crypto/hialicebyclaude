-- ============================================================================
-- Migration 009: Fix parents table RLS policies
-- The parents table was missing INSERT policy and service_role bypass,
-- causing registration to fail with "42501 row-level security policy" error.
-- ============================================================================

-- Allow service_role (backend) to INSERT new parent records during registration
CREATE POLICY "parents_insert_service_or_self"
  ON parents FOR INSERT
  WITH CHECK (
    auth_id = auth.uid()
    OR current_setting('role', true) = 'service_role'
  );

-- Allow service_role to SELECT parents (needed for backend queries)
DROP POLICY IF EXISTS "parents_can_view_own_profile" ON parents;
CREATE POLICY "parents_select_own_or_service"
  ON parents FOR SELECT
  USING (
    auth_id = auth.uid()
    OR current_setting('role', true) = 'service_role'
  );

-- Allow service_role to UPDATE parents (needed for COPPA consent updates)
DROP POLICY IF EXISTS "parents_can_update_own_profile" ON parents;
CREATE POLICY "parents_update_own_or_service"
  ON parents FOR UPDATE
  USING (
    auth_id = auth.uid()
    OR current_setting('role', true) = 'service_role'
  );
