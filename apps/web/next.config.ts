import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow ngrok dev origins
  allowedDevOrigins: ['a189-119-76-33-25.ngrok-free.app'],

  // Turbopack is default in Next.js 16 — empty config to suppress warnings
  turbopack: {},

  // Transpile workspace packages
  transpilePackages: ['@line-oa/config', '@line-oa/db', '@line-oa/shared'],

  // Image domains for LINE profile pictures
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
      },
      {
        protocol: 'https',
        hostname: 'sprofile.line-scdn.net',
      },
    ],
  },

  // Server external packages — don't bundle these, resolve at runtime
  serverExternalPackages: [
    'sharp',
    'pg',
    '@prisma/client',
    '@prisma/client-runtime-utils',
    '@prisma/adapter-pg',
  ],
};

export default nextConfig;
