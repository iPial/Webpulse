// Return the effective logo URL for a site.
// 1. Explicit logo_url from the DB wins.
// 2. Fall back to Google's favicon service (public, no key needed).
// 3. null if URL is malformed.
export function resolveLogoUrl(site, size = 64) {
  if (!site) return null;
  if (site.logo_url) return site.logo_url;
  try {
    const host = new URL(site.url).hostname;
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${host}`;
  } catch {
    return null;
  }
}
