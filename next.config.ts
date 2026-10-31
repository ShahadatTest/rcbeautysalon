import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E3-8 robustness fix: reactCompiler breaks form submit event wiring
  // in PRODUCTION builds (submit handlers never fire; the same form
  // works in dev). Correctness over memoization — re-enable only after
  // upstream fix + E2E green (e2e/ suite guards this regression).
  reactCompiler: false,
  images: {
    unoptimized: true, // Disable automatic image optimization
    qualities: [75, 90], // Configure allowed image qualities
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
