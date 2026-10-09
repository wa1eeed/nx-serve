/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for small, self-contained Docker images.
  output: 'standalone',
};
export default nextConfig;
