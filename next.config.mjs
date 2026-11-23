// Next.js owns the application's routing: every URL is a route file under app/ (see src/next/routes.tsx for the screen behind each).
// The app is a browser-only front-end (stores read localStorage/sessionStorage; see app/ClientRoot.tsx), served by `next start`.
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // No Next.js dev-tools badge (the round "N" in the corner) on the dev server: the app is reviewed as a prototype there. Production builds never show it.
  devIndicators: false,
  reactStrictMode: true,
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  // New Prepaid was catalogued as three "Tablet" step screens; it is one journey for web and tablet now.
  async redirects() {
    return [
      '/mobile-prepaid/new-prepaid-tablet-step-1-contact-id-capture',
      '/mobile-prepaid/new-prepaid-tablet-step-3-number-selection',
      '/mobile-prepaid/new-prepaid-tablet-step-4-sim-serial',
    ].map((source) => ({ source, destination: '/mobile-prepaid/new-prepaid', permanent: false })).concat([
      // The common Contact page of every New Connection journey moved from /mobile/start-connection to /start-connection: the old addresses (bookmarks, saved links) still arrive.
      { source: '/mobile/start-connection', destination: '/start-connection', permanent: false },
      { source: '/mobile/start-connection/existing/:customerId', destination: '/start-connection/existing/:customerId', permanent: false },
    ]);
  },
};
export default nextConfig;
