/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cnmqbbqgnbwvhbpwbyqn.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
