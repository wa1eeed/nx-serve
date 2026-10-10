/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for small, self-contained Docker images.
  output: 'standalone',
  // Workspace UI packages ship compiled dist, but transpiling keeps the
  // 'use client' boundary and modern syntax resolving cleanly in the monorepo.
  transpilePackages: ['@nxserve/ui-web', '@nxserve/domain'],
};
export default nextConfig;
