import { Suspense } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { Stats } from '@/components/landing/Stats';
import { Services } from '@/components/landing/Services';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

/**
 * หน้า landing (/) — cache ทุก 1 ชั่วโมง (ISR)
 *
 * Stats เป็น async Server Component ที่ query `case_stats_daily` — ห่อด้วย <Suspense>
 * เพื่อให้:
 *   (a) Next.js พยายาม prerender ส่วนอื่นก่อน ไม่บล็อกด้วย DB
 *   (b) ถ้า Stats ช้า/ล้มเหลว → แสดง fallback ไม่พังทั้งหน้า
 *
 * `revalidate = 3600` (1 ชม.) — refresh หน้าเป็นระยะ สอดคล้องกับที่ cron stats-refresh
 * ทำงาน (PRP-Plan กำหนดไว้รายวัน แต่ cache 1 ชม. ให้ latency ต่ำ + ข้อมูลใหม่พอใช้)
 */
export const revalidate = 3600;

function StatsFallback() {
  return (
    <section className="relative py-16 lg:py-20" aria-busy="true">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass h-36 animate-pulse rounded-2xl"
              style={{ backgroundColor: 'oklch(96% 0.01 145 / 0.5)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Suspense fallback={<StatsFallback />}>
          <Stats />
        </Suspense>
        <Services />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
