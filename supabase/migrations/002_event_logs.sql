-- ============================================
-- Webpulse — Event Logs (run after 001_initial.sql)
-- ============================================
-- Paste this whole file into Supabase SQL Editor and run.
--
-- Stores structured events (schedule runs, scans, notifications, AI calls)
-- so the /logs page can show a live feed of what the system is doing.

CREATE TABLE event_logs (
  id bigserial PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL,           -- schedule | scan | notification | ai | system
  level varchar(10) NOT NULL,          -- info | warn | error
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_logs_team_date ON event_logs (team_id, created_at DESC);
CREATE INDEX idx_event_logs_type ON event_logs (type);
CREATE INDEX idx_event_logs_level ON event_logs (level);

ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- Users can see logs for their own team (or system-wide logs with team_id IS NULL)
CREATE POLICY "Users can view their team logs"
  ON event_logs FOR SELECT
  USING (team_id IS NULL OR team_id IN (SELECT get_user_team_ids()));

-- Writes go through the service role (bypasses RLS)
