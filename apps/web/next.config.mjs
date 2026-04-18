import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  // PWA temporairement désactivée : le service worker cache /admin, /shop, /account
  // et casse la session (bug Phase 2). À réactiver Phase 3 avec exclusions correctes.
  disable: true,
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
};

export default withPWA(withNextIntl(nextConfig));
