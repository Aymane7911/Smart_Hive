import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Add headers for audio files
  async headers() {
    return [
      {
        // Apply these headers to all audio files in /voice directory
        source: '/voice/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'audio/mpeg',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        // Also handle .mp3 files anywhere in the app
        source: '/:path*.mp3',
        headers: [
          {
            key: 'Content-Type',
            value: 'audio/mpeg',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
        ],
      },
    ];
  },
  
  // Ensure webpack doesn't transform audio files
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });
    return config;
  },
};

export default nextConfig;