/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // PWA and offline support headers
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json'
          }
        ]
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8'
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  },

  // Optimize images
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp']
  },

  // Compression
  compress: true,

  // Performance optimizations
  swcMinify: true,

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['react-icons']
  }
};

module.exports = nextConfig;
