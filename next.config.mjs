/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true }, // usamos <img> para remotos
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  }
};
export default nextConfig;
