import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../components/site/site-header';
import { SiteFooter } from '../../components/site/site-footer';
import { TrackForm } from './track-form';

export const metadata: Metadata = { title: 'ติดตามเรื่อง' };

/**
 * /track — ค้นหาและดูสถานะเรื่องด้วยเลขติดตาม (HN + 9 หลัก)
 * [id] ของ GET /api/cases/[id] ตอนนี้คือ trackingCode (คล้าย EMS ไปรษณีย์ไทย)
 * ไม่ใช้ UUID PK เพราะ timestamp-ordered และเดาได้
 */

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          กลับหน้าหลัก
        </Link>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">ติดตามเรื่อง</h1>
        <p className="mt-3 text-lg text-muted">กรอกเลขติดตามเรื่อง เพื่อดูสถานะเรื่องที่ท่านแจ้ง</p>

        <TrackForm initialId={id} />
      </main>
      <SiteFooter />
    </div>
  );
}