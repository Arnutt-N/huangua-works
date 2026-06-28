import type { NextConfig } from 'next';

/**
 * next.config.ts — อบต.หัวงัว citizen-help
 * M0: minimal safe defaults. CSP + security headers (M-S5) จะเติมใน P1.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // productionBrowserSourceMaps: false (default) — ไม่รั่ว source map สู่ client
  experimental: {
    // optimizePackageImports สำหรับ Radix ลด bundle — เปิดเมื่อ deps ลงเรียบร้อย
    optimizePackageImports: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
  },
  // Headers ความปลอดภัยพื้นฐาน (full CSP nonce-based ที่ M-S5)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;