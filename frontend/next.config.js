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
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60,
  },

  // Compression
  compress: true,

  // Performance optimizations
  swcMinify: true,

  // Bundle analyzer — activate with ANALYZE=true npm run build
  ...(process.env.ANALYZE === 'true' && {
    webpack(config, { isServer }) {
      try {
        const { BundleAnalyzerPlugin } = require('@next/bundle-analyzer')({
          enabled: true,
        });
      } catch {
        // @next/bundle-analyzer not installed — skip silently
      }
      return config;
    },
  }),

  webpack(config, { dev }) {
    // The local preview environment has repeatedly suffered from corrupted
    // filesystem cache artifacts under `/.next/cache`. Disabling webpack's
    // persistent cache in development makes `next dev` slower on first load,
    // but much more reliable for iterative UI review.
    if (dev) {
      config.cache = false;
    }
    return config;
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['react-icons']
  }
};

module.exports = nextConfig;
