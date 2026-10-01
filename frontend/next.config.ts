import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // End-to-end tests build into their own directory so they never clobber `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
