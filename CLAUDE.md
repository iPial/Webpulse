# PageSpeed Monitor — Project Architecture

## Overview
Automated daily PageSpeed audits for 10-15 sites (scaling to SaaS).
Categorized reports (Fix Immediately / Future Improvement / Optional),
historical tracking, Slack alerts, email reports, Google Sheets export,
AI recommendations.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Recharts
- **Backend:** Vercel Serverless Functions (API routes)
- **Database:** Supabase Postgres (free tier, 500MB)
- **Auth:** Supabase Auth (email + OAuth)
- **Queue:** Upstash QStash (free tier, 500 msgs/day)
- **Cache:** Upstash Redis (free tier, 10K cmds/day)
- **Email:** Resend (free tier, 100/day)
- **Hosting:** Vercel (Hobby plan, free)
- **AI:** Anthropic API (Claude Sonnet) for recommendations

## Phased Scaling
- Phase 1 ($0/mo): 15 sites, 1-3 users, daily scans
- Phase 2 ($20/mo): Vercel Pro → 50 sites, 10 users
- Phase 3 ($55/mo): Supabase Pro + Upstash Pro → 500+ sites, multi-tenant SaaS

---

## Database Schema (Supabase Postgres)

### teams
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| name | varchar(255) | |
| slug | varchar(100) | unique, for URLs |
| plan | varchar(20) | 'free', 'pro', 'enterprise' |
| stripe_customer_id | varchar(255) | nullable, for billing later |
| created_at | timestamptz | default now() |

### team_members
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK → teams.id | |
| user_id | uuid FK → auth.users.id | Supabase Auth user |
| role | varchar(20) | 'owner', 'admin', 'viewer' |
| invited_at | timestamptz | default now() |

### sites
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| team_id | uuid FK → teams.id | |
| name | varchar(255) | |
| url | varchar(500) | |
| enabled | boolean | default true |
| scan_frequency | varchar(20) | 'daily', 'weekly', 'monthly' |
| tags | text[] | e.g. {'production', 'client-a'} |
| created_at | timestamptz | default now() |

### scan_results
| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| site_id | integer FK → sites.id | ON DELETE CASCADE |
| strategy | varchar(10) | 'mobile' or 'desktop' |
| performance | integer | 0-100 |
| accessibility | integer | 0-100 |
| best_practices | integer | 0-100 |
| seo | integer | 0-100 |
| fcp | varchar(50) | First Contentful Paint display value |
| lcp | varchar(50) | Largest Contentful Paint |
| tbt | varchar(50) | Total Blocking Time |
| cls | varchar(50) | Cumulative Layout Shift |
| si | varchar(50) | Speed Index |
| audits | jsonb | categorized audit list |
| scanned_at | timestamptz | default now() |
| INDEX | | (site_id, scanned_at DESC) |

### monthly_snapshots
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| site_id | integer FK → sites.id | ON DELETE CASCADE |
| month | varchar(7) | '2026-03' |
| performance | integer | |
| accessibility | integer | |
| best_practices | integer | |
| seo | integer | |
| critical_count | integer | default 0 |
| improvement_count | integer | default 0 |
| optional_count | integer | default 0 |
| avg_fcp_ms | integer | for trend analysis |
| avg_lcp_ms | integer | |
| UNIQUE | | (site_id, month) |

### integrations
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| team_id | uuid FK → teams.id | |
| type | varchar(50) | 'slack', 'email', 'sheets', 'webhook' |
| config | jsonb | webhook URLs, email lists, etc. |
| enabled | boolean | default true |
| created_at | timestamptz | default now() |

---

## Categorization Rules
- Score < 50% → 🔴 Fix Immediately
- Score 50-89% → 🟡 Future Improvement
- Score 90%+ → Passing (not reported)
- UPGRADE to 🔴 if: audit weight > 3 AND score < 70%
- UPGRADE to 🔴 if: LCP > 4s OR TBT > 600ms
- REGRESSION ALERT: performance drops 10+ points month-over-month

---

## Scan Architecture (Queue-Based)

```
Vercel Cron (daily 6AM UTC)
  → POST /api/scan/trigger
    → fetch all enabled sites from DB
    → for each site: push message to Upstash QStash
      → POST /api/scan/worker?siteId=X (one per site, parallel)
        → call Google PageSpeed API (mobile + desktop)
        → categorize audits
        → save to scan_results table
        → upsert monthly_snapshots
        → check for regressions
    → after all complete: POST /api/scan/notify
      → send Slack summary
      → check regression alerts
```

Each site scans in its own serverless function (15-30s).
Well under Vercel Hobby 60s timeout.
QStash retries failed scans 3x automatically.

---

## API Routes

### Scanning
- POST /api/scan/trigger — Cron entry, fans out to workers via QStash
- POST /api/scan/worker — Scans single site (called by QStash)
- POST /api/scan/notify — Post-scan notifications

### Data
- GET /api/sites — List sites (team-scoped)
- POST /api/sites — Add site
- PATCH /api/sites/[id] — Update site
- DELETE /api/sites/[id] — Delete site
- GET /api/results — Latest results (all or filtered by siteId)
- GET /api/results/[siteId] — Detail for one site
- GET /api/history/[siteId] — Monthly history

### Integrations
- POST /api/webhook — External scan trigger
- POST /api/ai — AI recommendations (Anthropic)
- POST /api/export/email — Send email report
- POST /api/export/sheets — Push to Google Sheets

### Auth (Supabase handles)
- /login — Auth page
- /auth/callback — OAuth callback

---

## Dashboard Pages
1. / — Overview (all sites grid, score rings, severity counts, trends)
2. /site/[id] — Site detail (mobile/desktop, vitals, categorized audits, AI)
3. /history — Month-over-month table + bar charts
4. /settings — Sites management
5. /settings/integrations — Slack, email, sheets config
6. /settings/team — Team members (Phase 3)
7. /login — Supabase Auth UI

---

## Environment Variables
| Variable | Required | Source |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Supabase dashboard |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Supabase dashboard |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase dashboard (server only) |
| GOOGLE_PSI_API_KEY | Yes | Google Cloud Console |
| CRON_SECRET | Yes | You generate |
| QSTASH_URL | Yes | Upstash console |
| QSTASH_TOKEN | Yes | Upstash console |
| UPSTASH_REDIS_REST_URL | Optional | Upstash console |
| UPSTASH_REDIS_REST_TOKEN | Optional | Upstash console |
| SLACK_WEBHOOK_URL | Optional | Slack app settings |
| ANTHROPIC_API_KEY | Optional | Anthropic console |
| RESEND_API_KEY | Optional | Resend dashboard |
| EMAIL_TO | Optional | Comma-separated emails |
| GOOGLE_SHEETS_ID | Optional | Google Sheets |

---

## Build Order (Sequential, with approval gates)

| Step | What | Files Created |
|---|---|---|
| 1 | Project scaffold | package.json, next.config.js, tailwind.config.js, .env.example, tsconfig.json, folder structure |
| 2 | Database schema | supabase/migrations/001_initial.sql |
| 3 | Auth setup | src/lib/supabase.js, src/middleware.js, src/app/login/page.jsx |
| 4 | DB helpers | src/lib/db.js |
| 5 | Scan engine | src/lib/pagespeed.js |
| 6 | Queue system | src/lib/queue.js, src/app/api/scan/trigger/route.js, src/app/api/scan/worker/route.js, src/app/api/scan/notify/route.js |
| 7 | API routes | src/app/api/sites/route.js, src/app/api/results/route.js, src/app/api/history/[siteId]/route.js |
| 8 | Slack integration | src/lib/slack.js |
| 9 | Dashboard — Layout + Overview | src/app/layout.jsx, src/app/page.jsx, src/components/* |
| 10 | Dashboard — Site Detail | src/app/site/[id]/page.jsx |
| 11 | Dashboard — History | src/app/history/page.jsx |
| 12 | Dashboard — Settings | src/app/settings/page.jsx, src/app/settings/integrations/page.jsx |
| 13 | AI analysis | src/app/api/ai/route.js |
| 14 | Email reports | src/lib/email.js, src/app/api/export/email/route.js |
| 15 | Google Sheets export | src/lib/sheets.js, src/app/api/export/sheets/route.js |
| 16 | Webhook endpoint | src/app/api/webhook/route.js |
| 17 | Deploy config | vercel.json, deployment guide |

---

## Design
- Dark theme (monitoring tool aesthetic)
- Tailwind CSS for styling
- Recharts for trend charts
- Score rings (SVG) for performance scores
- Color coding: green (#10B981) ≥90, yellow (#F59E0B) 50-89, red (#EF4444) <50

---

## Rules for Claude Code
- Build ONE step at a time. Wait for user approval before proceeding.
- Always create files in the correct directory structure.
- Use JavaScript (not TypeScript) for simplicity.
- Use App Router (not Pages Router).
- All database queries go through src/lib/db.js — never raw SQL in routes.
- All PageSpeed logic goes through src/lib/pagespeed.js.
- Every API route must handle errors and return proper HTTP status codes.
- Use Supabase RLS (Row Level Security) for team-scoped data access.
- Keep components small and focused. One file per component.
