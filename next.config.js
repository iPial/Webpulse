/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Site logos are loaded from arbitrary user-supplied logo_url values plus
  // Google's favicon service. Allow any HTTPS source so next/image can
  // optimize them (srcset for retina, WebP/AVIF, server-side downsizing).
  // Logo URLs are admin-only — only team owners/admins set them via the
  // Settings page — so accepting any host here is safe for our use case.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
