import type { MetadataRoute } from 'next';

/**
 * robots.txt — อนุญาตให้ crawl หน้าสาธารณะ ห้าม crawl ส่วนเจ้าหน้าที่/API
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.AUTH_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
