-- ============================================
-- Webpulse — Event Logs team isolation fix
-- ============================================
-- Paste into Supabase SQL Editor and run.
--
-- The original RLS policy on event_logs allowed any authenticated user
-- to read rows where team_id IS NULL. Several callers (QStash signature
-- failures, scheduler edge cases) write logs without a team_id, so
-- brand-new users were seeing months of unrelated system errors on
-- their /logs page. This migration:
--
-- 1. Replaces the SELECT policy so only rows belonging to the user's
--    own team(s) are visible. Orphan/system rows are no longer leaked.
-- 2. Cleans up existing orphan rows. They were noise (sig-verify
--    errors, etc.) and never useful per-team.

DROP POLICY IF EXISTS "Users can view their team logs" ON event_logs;

CREATE POLICY "Users can view their team logs"
  ON event_logs FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));

DELETE FROM event_logs WHERE team_id IS NULL;
