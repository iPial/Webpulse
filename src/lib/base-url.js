// Shared helper for resolving the public base URL used in Slack/email
// "View Full Report" links and the dashboard button accessory.
//
// Priority:
//   1. NEXT_PUBLIC_SITE_URL  — user-set override, always wins. Use this in
//      Vercel env to nail the canonical production URL.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel auto-sets this to the
//      production *alias* (e.g. webpulse-phi.vercel.app), regardless of
//      which deployment is currently running. Always public, no SSO wall.
//   3. VERCEL_URL — deployment-specific URL (e.g.
//      webpulse-rabp0g7xk-pials-projects-c7538fec.vercel.app). Almost always
//      gated by Vercel Deployment Protection on Pro plans, so links here
//      bounce visitors to an SSO page. Last-resort only.
//   4. Empty string — caller should treat as "no link" and skip the button.
export function getPublicBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return '';
}
