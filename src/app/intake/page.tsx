import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { categories as categoriesTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../components/site/site-footer';
import { IntakeForm } from './intake-form';

export const metadata: Metadata = { title: 'แจ้งเรื่องใหม่' };

// § force-dynamic: หน้านี้ query categories จาก DB ระดับ Server Component รันทุก request
// ห้ามให้ Next.js prerender เป็น static HTML ตอน build เพราะ build machine จะต้องต่อ DB
// (Supabase) ตอน build → fragile และช้า อีกทั้ง categories ควรสดใหม่ (admin เพิ่มหมวดได้ตลอด)
export const dynamic = 'force-dynamic';

/**
 * /intake — ฟอร์มแจ้งเหตุ
 * เชื่อม POST /api/cases/submit จริง (rate-limit + dedup + CID validate ทำงานแล้วจาก T-2/T-7)
 */

export default async function IntakePage() {
  const db = await getDb();
  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(categoriesTable.name);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <Navbar />
      <main className="relative overflow-hidden mesh-gradient">
        <div className="absolute inset-0 thai-pattern pointer-events-none" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            กลับหน้าหลัก
          </Link>

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">แจ้งเรื่องใหม่</h1>
          <p className="mt-3 text-lg text-muted">
            กรอกข้อมูลให้ครบ เจ้าหน้าที่จะรับเรื่องและติดตามให้ท่านทุกขั้นตอน
          </p>

          <IntakeForm categories={categories} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}