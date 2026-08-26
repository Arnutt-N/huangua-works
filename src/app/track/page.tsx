import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../components/site/site-footer';
import { LiffProvider } from '@/components/liff/liff-provider';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { getMyCases } from '@/lib/cases/my-cases';
import { formatThaiDateLong } from '@/lib/thai-date';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';
import { TrackForm } from './track-form';

export const metadata: Metadata = { title: 'ติดตามเรื่อง' };

/**
 * /track — ค้นหาและดูสถานะเรื่องด้วยเลขติดตาม (HG + 9 หลัก)
 * [id] ของ GET /api/cases/[id] ตอนนี้คือ trackingCode (คล้าย EMS ไปรษณีย์ไทย)
 * ไม่ใช้ UUID PK เพราะ timestamp-ordered และเดาได้
 *
 * ถ้ามี liff session cookie (เข้าจาก LINE) จะแสดง "เรื่องของฉัน" — เคสทุกเรื่อง
 * ที่ผูกกับบัญชี LINE ของผู้ใช้ โดยไม่ต้องพิมพ์รหัส (D2)
 */

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  // § อ่าน cookie ฝั่ง server ตรง ๆ — ไม่ต้องรอ provider ฝั่ง client (แต่กรณีเข้า
  // LIFF ตรงที่ /track ครั้งแรก cookie ยังไม่มี LiffProvider จะสร้างให้แล้ว
  // router.refresh() ให้ section นี้โผล่หลัง render รอบสอง)
  const cookieStore = await cookies();
  const liffSession = readLiffSessionValue(cookieStore.get(LIFF_SESSION_COOKIE)?.value);
  const myCases = liffSession ? await getMyCases(liffSession.lineUserId) : [];

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

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">ติดตามเรื่อง</h1>
          <p className="mt-3 text-lg text-muted">กรอกเลขติดตามเรื่อง เพื่อดูสถานะเรื่องที่ท่านแจ้ง</p>

          {myCases.length > 0 && (
            <section className="glass mt-8 rounded-xl p-6 shadow-sm" aria-labelledby="my-cases-heading">
              <h2 id="my-cases-heading" className="text-xl font-semibold">
                เรื่องของฉัน{' '}
                <span className="text-sm font-normal text-muted">(จากบัญชี LINE ของท่าน)</span>
              </h2>
              <ul className="mt-4 space-y-3" data-testid="my-cases-list">
                {myCases.map((item) => (
                  <li
                    key={item.trackingCode}
                    className="border-border bg-surface-raised flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
                  >
                    <CaseStatusBadge status={item.status} />
                    <span className="text-ink min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>
                      {item.title}
                    </span>
                    <span className="text-muted font-mono text-xs">{item.trackingCode}</span>
                    <span className="text-muted text-xs">อัปเดต {formatThaiDateLong(new Date(item.updatedAt))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LiffProvider>
            <TrackForm initialId={id} />
          </LiffProvider>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}