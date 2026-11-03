/**
 * public/sw.js
 *
 * Service Worker สำหรับ อบต.หัวงัว (P3-01 Field Staff PWA)
 * จัดการ Caching สำหรับ App Shell, Static Assets และ Offline Fallback
 */

const CACHE_NAME = 'huangua-pwa-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
    }).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // ไม่แคชคำขอที่ไม่ใช่ GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // ไม่แคช API routes, Auth endpoints หรือหน้าแอดมิน (/admin) ที่มีข้อมูลส่วนบุคคล (PII)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // คำขอแบบนำทางหน้า (HTML navigation) -> Network First, Fallback to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // เก็บสำเนาหน้าเว็บล่าสุดลงแคช (เฉพาะหน้าที่ไม่ใช่ /admin)
          if (response && response.status === 200 && !url.pathname.startsWith('/admin')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlineFallback = await caches.match(OFFLINE_URL);
          if (offlineFallback) {
            return offlineFallback;
          }
          return new Response(
            '<html><head><meta charset="utf-8"><title>ออฟไลน์ - อบต.หัวงัว</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h2><p>กรุณาตรวจสอบสัญญาณเครือข่ายของท่าน</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }),
    );
    return;
  }

  // Static Assets (_next/static, fonts, icons) -> Stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 503, statusText: 'Service Unavailable' }));

        return cached || fetchPromise;
      }),
    );
  }
});
