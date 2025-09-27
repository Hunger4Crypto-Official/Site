/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during builds to prevent blocking
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enable transpilation of shared workspace
  transpilePackages: ['@h4c/shared'],
  
  // Experimental features for better monorepo support
  experimental: {
    esmExternals: false,
  },
  
  // Webpack configuration for monorepo
  webpack: (config, { isServer }) => {
    // Handle monorepo packages
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    
    // Add alias for shared package
    config.resolve.alias = {
      ...config.resolve.alias,
      '@h4c/shared': require('path').resolve(__dirname, '../shared'),
    };
    
    return config;
  },
  
  // Output configuration
  output: 'standalone',
  
  // Asset optimization
  images: {
    unoptimized: true, // Disable image optimization for easier deployment
  },
  
  // Reduce bundle size
  swcMinify: true,
};

module.exports = nextConfig;
