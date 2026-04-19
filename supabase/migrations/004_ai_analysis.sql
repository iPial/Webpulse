-- ============================================
-- Webpulse — Persist the latest AI analysis per site
-- ============================================
-- Paste into Supabase SQL Editor and run.

ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_markdown text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz;
