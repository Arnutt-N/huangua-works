import type { MetadataRoute } from 'next';

/**
 * sitemap.xml — รายการหน้าสาธารณะที่ควร index
 *
 * ไม่รวม /admin/* (เป็นส่วนเจ้าหน้าที่ ต้อง login)
 *
 * AUTH_URL ต้องตั้งใน env (verify-env.ts enforce) — เป็น production URL
 * ใน dev จะ fallback ไป http://localhost:3000
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.AUTH_URL || 'http://localhost:3000';
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/intake`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/track`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
