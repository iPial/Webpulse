-- 006_public_sites.sql
--
-- Adds an `is_public` flag to the sites table. When true, /site/[id] is
-- accessible without authentication in read-only mode, so Slack/email
-- "View Full Report" links work for stakeholders without accounts.
--
-- Defaults to FALSE so existing sites stay private.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Index helps the public-fetch path (which looks up a single site by id
-- and confirms is_public=true). Tiny table, but cheap to add.
CREATE INDEX IF NOT EXISTS idx_sites_is_public ON sites(is_public) WHERE is_public = TRUE;
