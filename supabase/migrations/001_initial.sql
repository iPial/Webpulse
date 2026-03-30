-- ============================================
-- PageSpeed Monitor — Initial Schema
-- ============================================

-- Teams
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  slug varchar(100) UNIQUE NOT NULL,
  plan varchar(20) NOT NULL DEFAULT 'free',
  stripe_customer_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Team Members (links Supabase Auth users to teams)
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'viewer')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- Sites
CREATE TABLE sites (
  id serial PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  url varchar(500) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  scan_frequency varchar(20) NOT NULL DEFAULT 'daily',
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scan Results
CREATE TABLE scan_results (
  id bigserial PRIMARY KEY,
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  strategy varchar(10) NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  performance integer CHECK (performance BETWEEN 0 AND 100),
  accessibility integer CHECK (accessibility BETWEEN 0 AND 100),
  best_practices integer CHECK (best_practices BETWEEN 0 AND 100),
  seo integer CHECK (seo BETWEEN 0 AND 100),
  fcp varchar(50),
  lcp varchar(50),
  tbt varchar(50),
  cls varchar(50),
  si varchar(50),
  audits jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_results_site_date ON scan_results (site_id, scanned_at DESC);
CREATE INDEX idx_team_members_user_id ON team_members (user_id);
CREATE INDEX idx_sites_team_id ON sites (team_id);

-- Monthly Snapshots (aggregated for trend analysis)
CREATE TABLE monthly_snapshots (
  id serial PRIMARY KEY,
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  month varchar(7) NOT NULL,
  performance integer,
  accessibility integer,
  best_practices integer,
  seo integer,
  critical_count integer NOT NULL DEFAULT 0,
  improvement_count integer NOT NULL DEFAULT 0,
  optional_count integer NOT NULL DEFAULT 0,
  avg_fcp_ms integer,
  avg_lcp_ms integer,
  UNIQUE (site_id, month)
);

-- Integrations (Slack, email, sheets, webhooks)
CREATE TABLE integrations (
  id serial PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Helper: get team IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

-- Teams: users can see teams they belong to
CREATE POLICY "Users can view their teams"
  ON teams FOR SELECT
  USING (id IN (SELECT get_user_team_ids()));

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can update their teams"
  ON teams FOR UPDATE
  USING (id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Team Members: users can see members of their teams
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "Users can insert themselves as team member"
  ON team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can manage team members"
  ON team_members FOR UPDATE
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "Owners can delete team members"
  ON team_members FOR DELETE
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- Sites: team-scoped access
CREATE POLICY "Users can view their team sites"
  ON sites FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "Admins can manage sites"
  ON sites FOR ALL
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Scan Results: viewable if user belongs to the site's team
CREATE POLICY "Users can view scan results"
  ON scan_results FOR SELECT
  USING (site_id IN (
    SELECT id FROM sites WHERE team_id IN (SELECT get_user_team_ids())
  ));

-- Note: scan_results INSERT/UPDATE handled by service role (bypasses RLS)

-- Monthly Snapshots: same as scan results
CREATE POLICY "Users can view monthly snapshots"
  ON monthly_snapshots FOR SELECT
  USING (site_id IN (
    SELECT id FROM sites WHERE team_id IN (SELECT get_user_team_ids())
  ));

-- Note: monthly_snapshots INSERT/UPDATE handled by service role (bypasses RLS)

-- Integrations: team-scoped
CREATE POLICY "Users can view their integrations"
  ON integrations FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));
