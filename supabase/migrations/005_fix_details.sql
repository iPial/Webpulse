-- ============================================
-- Webpulse — Richer fix metadata (run after 004_ai_analysis.sql)
-- ============================================
-- Paste into Supabase SQL Editor and run.

ALTER TABLE site_fixes ADD COLUMN IF NOT EXISTS impact varchar(20);
ALTER TABLE site_fixes ADD COLUMN IF NOT EXISTS expected_gain varchar(80);
ALTER TABLE site_fixes ADD COLUMN IF NOT EXISTS rocket_path varchar(200);
ALTER TABLE site_fixes ADD COLUMN IF NOT EXISTS caveats text;
