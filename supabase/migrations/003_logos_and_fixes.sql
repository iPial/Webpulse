-- ============================================
-- Webpulse — Site logos + AI fix tracker (run after 002_event_logs.sql)
-- ============================================
-- Paste this whole file into Supabase SQL Editor and run.

-- 1) Add optional logo URL per site. When NULL, the app falls back to a
-- public favicon service derived from the site URL.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS logo_url varchar(500);

-- 2) Per-site AI fix tracker. One row per (site, fix title).
CREATE TABLE IF NOT EXISTS site_fixes (
  id bigserial PRIMARY KEY,
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,                       -- AI-provided fix title (match key)
  action text,                                        -- latest action text from AI
  status varchar(20) NOT NULL DEFAULT 'pending',      -- 'pending' | 'fixed'
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  fixed_at timestamptz,
  needs_reverify boolean NOT NULL DEFAULT false,
  UNIQUE (site_id, title)
);

CREATE INDEX IF NOT EXISTS idx_site_fixes_site ON site_fixes (site_id, status);

ALTER TABLE site_fixes ENABLE ROW LEVEL SECURITY;

-- Users can read fixes for sites in their teams
DROP POLICY IF EXISTS "Users view fixes for their sites" ON site_fixes;
CREATE POLICY "Users view fixes for their sites"
  ON site_fixes FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE team_id IN (SELECT get_user_team_ids())));

-- Owners / admins can manage them
DROP POLICY IF EXISTS "Admins manage fixes" ON site_fixes;
CREATE POLICY "Admins manage fixes"
  ON site_fixes FOR ALL
  USING (site_id IN (
    SELECT id FROM sites WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  ));

-- Writes from the scheduler / AI route go through the service role (bypasses RLS).
