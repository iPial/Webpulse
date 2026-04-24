# Webpulse redesign — handoff brief for Claude Code

This folder contains a complete UI redesign of the Webpulse app, delivered as a self-contained multi-page static HTML site. Use it as the visual + structural reference for porting the new design into the production Next.js codebase.

**Aesthetic:** Bento grid + soft 3D. Warm cream paper base, electric lime primary, molten orange + violet accents, ink (near-black) hero tiles. Typography pairs Instrument Serif (editorial display + big numbers) with Inter (UI) and JetBrains Mono (metric readouts).

---

## Files in this folder

```
assets/
  styles.css          ← design tokens + all components (canonical source of truth)
  app.js              ← vanilla SVG sparkline / multi-line / bar chart renderers
index.html            ← marketing landing (new — no current equivalent)
login.html            ← /login
signup.html           ← /signup
overview.html         ← /              (Overview dashboard)
history.html          ← /history
logs.html             ← /logs
settings.html         ← /settings      (Sites tab)
settings-team.html    ← /settings/team
settings-integrations.html ← /settings/integrations
site.html             ← /site/[id]     (per-site report)
```

Open `index.html` in a browser to navigate the full set — every sidebar and tab link is wired.

---

## Suggested first prompt for Claude Code

Copy-paste this as your first message after running `claude` in the project root:

> I have a new UI design in `design/webpulse-redesign/` (or wherever you dropped it). It is 10 static HTML pages plus `assets/styles.css` and `assets/app.js`. The mapping from file to route is documented in `HANDOFF.md`.
>
> Before writing any code, please:
> 1. Read `HANDOFF.md` and `assets/styles.css` in full.
> 2. Skim each HTML file to understand the bento layout per page.
> 3. Produce a migration plan covering:
>    - Which design tokens to lift into our Tailwind theme (or existing token system).
>    - Which shared primitives to build first, in build order.
>    - Page-by-page porting order, flagging any data-shape mismatches with our current API.
>    - Any dependencies to add (fonts, icon library) and any to remove (if a charting lib is no longer needed).
> 4. Wait for me to approve the plan before coding.

---

## Migration plan skeleton (for Claude Code to flesh out)

### Phase 0 — Tokens
Port the `:root` block from `assets/styles.css` into the Tailwind theme (or equivalent). Every hardcoded hex in subsequent components should reference a token, not a literal.

- Colors: paper / paper-2 / surface / surface-2 / ink / ink-2 / muted / line — plus brand (lime, orange, violet, cobalt, sky, rose) and semantic (good, warn, bad) with -bg variants.
- Radii: r-xs 8px, r-sm 12px, r-md 18px, r-lg 24px, r-xl 32px, r-pill 999px.
- Shadows: shadow-1 / shadow-2 / shadow-3 (soft 3D), plus shadow-lime / shadow-orange / shadow-ink for accent tiles.
- Fonts: Inter (UI), Instrument Serif (display), JetBrains Mono (numbers). Load via `next/font`.

### Phase 1 — Shared primitives
Build these before touching any page. They cover ~80% of the UI:

- [ ] `<Card>` — supports variants: default / ink / lime / orange / violet / cream / rose / sky, plus `spanX` bento grid sizing.
- [ ] `<BentoGrid>` — 12-col grid, gap 14px, responsive collapse at 1100px and 640px.
- [ ] `<Pill>` — variants: default / good / warn / bad / ink / lime, with optional leading dot.
- [ ] `<Button>` — variants: default / primary (lime) / ink / ghost / danger, sizes sm/md/lg.
- [ ] `<Input>` / `<Select>` / `<Textarea>` — matched soft-3D styling.
- [ ] `<Tabs>` — pill-shaped tab group used on Settings + Logs.
- [ ] `<ScoreRing>` — the conic-gradient score ring from site.html (good/warn/bad color + score value).
- [ ] `<Sparkline>` / `<LineChart>` / `<BarChart>` — port `assets/app.js` directly. Keep the inline SVG approach unless a lib is already installed.
- [ ] `<AppShell>` — sidebar + topbar, used by every authenticated page.

### Phase 2 — Pages, in recommended build order

Build in this order so each page reuses primitives proven by the previous one:

1. **Login + Signup** — minimal, proves the auth card, inputs, OAuth buttons, split-screen layout.
2. **Settings (Sites)** — proves the table, form inputs, inline-action buttons, and the three-tab shell.
3. **Settings (Team + Integrations)** — reuses the shell; adds role chips, avatar generator, switch-button toggle.
4. **Logs** — proves the live-feed row layout, filters, pulse animation.
5. **History** — proves the multi-line chart + the monthly breakdown table.
6. **Overview** — the payoff page. Uses almost every primitive; build last of the app pages.
7. **Site detail** — the largest page; reuses everything. Biggest net-new pieces: 120px score ring, CWV cards, AI-recommendations card, fix-tasks checklist.
8. **Landing** — optional. Rebuild only if you actually want a marketing page; otherwise delete and point `/` at the dashboard.

---

## Per-page checklist

### `overview.html` → `/`
- [ ] Topbar: date eyebrow, title, "2 sites monitored · N critical issues" subtitle, action buttons (Send to Slack / Weekly trend / Email report / Scan all).
- [ ] Bento tile: large ink hero showing total critical-issue count with status pills.
- [ ] Two lime/cream KPI tiles with sparklines and bar chart.
- [ ] Per-site card (repeat for each site): logo, name, URL, critical count, mobile pill, 4-score grid, 4-CWV grid, 14-day trend spark.
- [ ] Grouped activity feed with day headers (Today / Yesterday / explicit date), each row: timestamp · site+strategy · LCP readout · 4 mini score pills.

### `history.html` → `/history`
- [ ] Site switcher (pill toggle) in topbar.
- [ ] Four KPI cards: current perf, period label card (lime), avg LCP, open issues.
- [ ] Multi-line score-trend chart (Perf / A11y / BP / SEO).
- [ ] CWV trend chart on ink background (FCP / LCP).
- [ ] Monthly breakdown table with delta arrows.

### `logs.html` → `/logs`
- [ ] Pulse animation on "Live" eyebrow.
- [ ] 5-stat summary row (events 24h / successful / warnings / errors / AI calls).
- [ ] Filter bar: type tabs + level tabs + search input + auto-refresh toggle.
- [ ] Log rows with colored left stripe per kind (schedule/scan/ai/notification/system) + level pill.

### `settings.html` → `/settings` (Sites tab)
- [ ] Three-tab nav (Sites / Team / Integrations) in topbar.
- [ ] Ink hero "scheduled scans" card with per-site schedule entries and Run-now buttons.
- [ ] Lime quick-add card (site name / URL / frequency / logo URL).
- [ ] Full sites table (name + logo + URL + frequency + next scan + status + integration chip + actions).
- [ ] Account section (change password) + danger zone (export / delete workspace).

### `settings-team.html` → `/settings/team`
- [ ] Lime seat-usage card with progress bar.
- [ ] Invite form + pending invites list.
- [ ] Team roster table with avatar, role chip (owner/admin/editor/viewer), last-active, actions.

### `settings-integrations.html` → `/settings/integrations`
- [ ] PageSpeed API key card.
- [ ] Ink AI-provider card with Anthropic / OpenAI / Gemini picker + API key input.
- [ ] Slack integration with webhook URL + channel + test button + switch toggle.
- [ ] Email reports with recipient chips + digest schedule + test button + switch toggle.
- [ ] Webhooks (setup) + GA4 (optional) placeholder cards.

### `site.html` → `/site/[id]`
Largest page. Port in these sub-chunks:
- [ ] Site hero: big logo + title + meta row + mobile/desktop strategy toggle + Scan Now / Add to fixes actions.
- [ ] Score hero: 120px ScoreRing + caption + 4-score grid.
- [ ] Mobile-vs-desktop compare card.
- [ ] 7-scan mobile trend chart with critical/improvement pill badges.
- [ ] 5 CWV cards (FCP / LCP / TBT / CLS / Speed Index) with threshold bar + fix tip.
- [ ] Lime AI-recommendations card with numbered items including WP Rocket paths and caveats.
- [ ] Ink fix-tasks checklist (N / 9 counter).
- [ ] Critical-issues table with Fix-immediately / Improve / Passed tabs.
- [ ] Scan history table with delta arrows and strategy pills.

### `login.html` + `signup.html` → `/login`, `/signup`
- [ ] Split-screen layout (brand panel + form panel).
- [ ] Brand side: live mini-dashboard preview (login) or checklist (signup).
- [ ] Form side: email/password, Sign-in CTA, "Use magic link" button, Google + GitHub OAuth, cross-link to the other auth page.

### `index.html` → marketing landing (optional)
- [ ] Top nav pill.
- [ ] Hero: editorial title with lime highlight box, live product preview tile, lime AI-suggestion tile, 3-stat row.
- [ ] Feature bento (6 tiles).
- [ ] 3-tier pricing (Starter / Pulse / Scale).
- [ ] Footer.

---

## Gotchas + advice

- **Don't use CSS variables inline** in React components when a Tailwind utility exists — but do use `var(--lime)` style references for the accent tile gradients. That's deliberate.
- **Fonts:** Instrument Serif is used *only* for headline + numeric display. Don't let it leak into body copy or button labels — readability drops fast at small sizes.
- **The bento grid collapses at 1100px** (span-3/4 → span-6) and again at 640px (everything → span-12). Match this in the Tailwind component.
- **Score colors** follow Lighthouse convention: <50 = bad (orange), 50–89 = warn, ≥90 = good.
- **Site logos** are gradient-filled rounded squares with monogram — the data should live on the Site model (two colors + initials), not be rendered from URL.
- **Don't add a charting library.** The 3 functions in `app.js` cover every chart in the redesign in ~150 lines of vanilla SVG. Port them to a React component — it'll match exactly.
- **Ring color for ScoreRing uses conic-gradient** — works in all modern browsers; no polyfill needed.
- **Activity feed** is grouped by day in the mockup. Do the grouping in the component, not in the API — the API should return a flat list sorted desc.

---

## Data-shape reminders (from the existing app)

The current site at webpulse-phi.vercel.app already exposes these fields, which the redesign relies on:

- Site: `{ id, name, url, logoUrl, frequency, nextScan, status, integration }`
- Scan: `{ timestamp, strategy: "mobile"|"desktop", perf, a11y, bp, seo, fcp, lcp, tbt, cls, si }`
- Delta: computed vs. previous scan of the same strategy.
- Issue: `{ id, title, category, score, impact: "hi"|"me"|"lo", savings? }` — surfaced as the Fix Immediately / Improve buckets.
- AI recommendation: `{ title, impact, rocketPath?, action, caveats }` — the WP Rocket path field is optional.
- FixTask: one per AI recommendation, `{ id, label, expectedGain, done }`.

If any of these don't already exist on your models, flag them in your migration plan.

---

**Questions or divergences from the mockup should come back to me as a short numbered list, not as silent interpretation.** The redesign is opinionated — if you find something that reads as incidental, assume it was intentional until we discuss it.
