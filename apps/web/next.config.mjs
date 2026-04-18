import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
};

export default withPWA(withNextIntl(nextConfig));
