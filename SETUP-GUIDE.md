# Setup Guide — PageSpeed Monitor

Follow these steps in order. Total time: ~10 minutes.

---

## Step 1: Install Claude Code (30 seconds)

Open Terminal on your Mac and run:

```bash
curl -fsSL https://code.claude.com/install | sh
```

Verify it installed:

```bash
claude --version
```

You should see a version number printed.

---

## Step 2: Authenticate Claude Code (1 minute)

Run:

```bash
claude
```

A browser window opens. Log in with your Anthropic account (the one with Max subscription). Follow the prompts. One-time setup.

> You're on Claude Max — this gives you the highest Claude Code usage limits.
> You can build all 17 steps in a single session without worrying about rate limits.

After authenticating, press `Ctrl+C` to exit for now.

---

## Step 3: Create Your Project Folder (30 seconds)

```bash
mkdir ~/pagespeed-monitor
cd ~/pagespeed-monitor
git init
```

---

## Step 4: Add the Architecture File (1 minute)

Copy the `CLAUDE.md` file (provided separately) into your project root:

```bash
# The CLAUDE.md file should be at:
# ~/pagespeed-monitor/CLAUDE.md
```

Claude Code reads this file automatically when you enter the project.
It contains the full architecture, database schema, build order, and rules.

---

## Step 5: Set Up External Services (5-10 minutes)

You'll need these accounts. All are free:

### 5a. Supabase (Database + Auth)
1. Go to https://supabase.com → Sign up (free)
2. Create a new project (any name, choose closest region)
3. Wait for it to provision (~2 minutes)
4. Go to Settings → API → copy these:
   - Project URL (looks like: https://xxxxx.supabase.co)
   - anon/public key (starts with: eyJ...)
   - service_role key (starts with: eyJ..., keep this SECRET)

### 5b. Upstash QStash (Job Queue)
1. Go to https://upstash.com → Sign up (free)
2. Go to QStash tab
3. Copy:
   - QSTASH_URL
   - QSTASH_TOKEN

### 5c. Upstash Redis (Cache) — Optional for Phase 1
1. In same Upstash dashboard → Create Redis Database
2. Copy:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN

### 5d. Google PageSpeed API Key
1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Go to APIs & Services → Enable APIs
4. Search "PageSpeed Insights API" → Enable it
5. Go to Credentials → Create Credentials → API Key
6. Copy the key
7. IMPORTANT: Restrict the key to "PageSpeed Insights API" only

### 5e. Slack Webhook — Optional
1. Go to https://api.slack.com/apps → Create New App
2. Choose "From scratch", pick your workspace
3. Go to Incoming Webhooks → Activate → Add New Webhook
4. Pick a channel → Copy the webhook URL

### 5f. Resend (Email) — Optional
1. Go to https://resend.com → Sign up (free)
2. Create an API key → Copy it

---

## Step 6: Start Building!

```bash
cd ~/pagespeed-monitor
claude
```

Once Claude Code starts, type:

```
Read the CLAUDE.md file, then let's build Step 1 — Project scaffold.
Create package.json, next.config.js, tailwind.config.js, .env.example,
tsconfig.json, and the full folder structure.
```

Claude Code will:
1. Read your CLAUDE.md (full architecture context)
2. Create all the files for Step 1
3. Show you what it's doing
4. Ask for approval before making changes

After Step 1 is done, you say:

```
Step 1 approved. Let's build Step 2 — Database schema migration file.
```

And so on, all the way through Step 17.

---

## Step 7: Deploy to Vercel (after all steps done)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add all environment variables in Vercel Dashboard → Settings → Environment Variables.

---

## Tips for Working with Claude Code

- **Review every change** — Claude Code shows diffs before applying
- **Be specific** — "Build Step 5" is better than "build the scanning thing"
- **Test as you go** — After each step, run `npm run dev` to verify
- **If something breaks** — Tell Claude Code: "The X feature is broken, here's the error: ..."
- **Save progress** — Commit after each step: `git add . && git commit -m "Step X complete"`

---

## Build Order Quick Reference

| Step | What |
|---|---|
| 1 | Project scaffold (package.json, configs, folders) |
| 2 | Database schema (Supabase SQL migration) |
| 3 | Auth (Supabase Auth, login page, middleware) |
| 4 | DB helper functions (src/lib/db.js) |
| 5 | Scan engine + categorization (src/lib/pagespeed.js) |
| 6 | Queue system (QStash trigger + worker) |
| 7 | API routes (sites CRUD, results, history) |
| 8 | Slack integration |
| 9 | Dashboard — Overview page |
| 10 | Dashboard — Site Detail page |
| 11 | Dashboard — History page |
| 12 | Dashboard — Settings page |
| 13 | AI analysis endpoint |
| 14 | Email reports |
| 15 | Google Sheets export |
| 16 | Webhook trigger endpoint |
| 17 | vercel.json + deploy |
