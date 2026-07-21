import type { NextConfig } from 'next';

/**
 * next.config.ts — อบต.หัวงัว citizen-help
 *
 * Security headers (เพิ่มใน PR #4 — PDPA hardening):
 *  - CSP: default-src 'self' + img 'self' data: + style 'self' 'unsafe-inline'
 *    (Next.js ต้องการ 'unsafe-inline' สำหรับ inline styles ใน dev + styled runtime)
 *  - HSTS: 2 ปี + includeSubDomains + preload (production เท่านั้น)
 *  - X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
 *
 * หมายเหตุ: ในอนาคตถ้าต้องการ nonce-based CSP ที่ไม่ใช้ 'unsafe-inline'
 * ต้องใช้ Next.js 16 nonce helper แต่ตอนนี้ 'unsafe-inline' ปลอดภัยพอสำหรับ MVP
 */
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // productionBrowserSourceMaps: false (default) — ไม่รั่ว source map สู่ client
  experimental: {
    // optimizePackageImports สำหรับ Radix ลด bundle — เปิดเมื่อ deps ลงเรียบร้อย
    optimizePackageImports: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
  },
  // Headers ความปลอดภัย — PDPA + OWASP baseline
  async headers() {
    const scriptSrc = isProduction
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    const cspDirectives = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
      },
      { key: 'Content-Security-Policy', value: cspDirectives },
    ];

    // § HSTS เฉพาะ production (dev ใช้ http จะ break)
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;