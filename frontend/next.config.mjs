/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-3.api-sports.io' },
      { protocol: 'https', hostname: 'media-4.api-sports.io' },
    ],
  },
  async redirects() {
    return [
      // Short-form auth aliases → canonical routes under /auth/
      { source: '/login',    destination: '/auth/login',    permanent: false },
      { source: '/register', destination: '/auth/register', permanent: false },
      { source: '/signup',   destination: '/auth/register', permanent: false },
      { source: '/forgot',   destination: '/auth/forgot',   permanent: false },
      { source: '/logout',   destination: '/auth/login',    permanent: false },
      // /account → user dashboard
      { source: '/account',  destination: '/dashboard',     permanent: false },
    ];
  },
};

export default nextConfig;
