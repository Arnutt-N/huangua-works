import { ArrowLeft, User } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '@/components/site/site-footer';
import { LiffProvider } from '@/components/liff/liff-provider';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { listMyCases } from '@/lib/cases/citizen-access';
import { formatThaiDateLong } from '@/lib/thai-date';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';
import { getDb } from '@/lib/db';
import { findLineUserByRaw } from '@/lib/line/identity';
import { COPY } from '@/lib/copy';
import { TrackForm } from './track-form';

export const metadata: Metadata = { title: COPY.TRACK_LABEL };

/**
 * /track — ค้นหาและดูสถานะเรื่องด้วยเลขติดตาม (HG + 9 หลัก)
 * [id] ของ GET /api/cases/[id] ตอนนี้คือ trackingCode (คล้าย EMS ไปรษณีย์ไทย)
 * ไม่ใช้ UUID PK เพราะ timestamp-ordered และเดาได้
 *
 * ถ้ามี liff session cookie (เข้าจาก LINE) จะแสดง "เรื่องของฉัน" — เคสทุกเรื่อง
 * ที่ผูกกับบัญชี LINE ของผู้ใช้ โดยไม่ต้องพิมพ์รหัส (D2) เฉพาะเรื่องที่เจ้าของยังให้
 * ความยินยอมอยู่ (กติกาเดียวกับ GET /api/cases/[id] — ดู citizen-access)
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
  const myCases = liffSession ? await listMyCases(liffSession.lineUserId) : [];

  let lineProfile: { displayName: string | null; pictureUrl: string | null } | null = null;
  if (liffSession) {
    try {
      const db = await getDb();
      const userRow = await findLineUserByRaw(db, liffSession.lineUserId);
      if (userRow) {
        lineProfile = {
          displayName: userRow.displayName,
          pictureUrl: userRow.pictureUrl,
        };
      }
    } catch {
      // fallback gracefully if DB query fails
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <Navbar />
      <main id="main" className="relative overflow-hidden mesh-gradient">
        <div className="absolute inset-0 thai-pattern pointer-events-none" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {COPY.BACK_HOME}
            </Link>
            {id && (
              <Link
                href="/track"
                className="inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                กลับสู่รายการเรื่องของฉัน
              </Link>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{COPY.TRACK_LABEL}</h1>
          <p className="mt-3 text-lg text-muted">กรอกเลขติดตามเรื่อง เพื่อดูสถานะเรื่องที่ท่านแจ้ง</p>

          {liffSession && (
            <div
              role="status"
              data-testid="liff-connected-banner"
              className="mt-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-ink"
            >
              {lineProfile?.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lineProfile.pictureUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100 text-accent-strong">
                  <User className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-semibold text-base"
                  title={
                    lineProfile?.displayName
                      ? `บัญชี LINE: ${lineProfile.displayName}`
                      : 'เชื่อมต่อกับบัญชี LINE ของท่านเรียบร้อยแล้ว'
                  }
                >
                  {lineProfile?.displayName
                    ? `บัญชี LINE: ${lineProfile.displayName}`
                    : 'เชื่อมต่อกับบัญชี LINE ของท่านเรียบร้อยแล้ว'}
                </p>
                <p className="text-sm text-muted">
                  แสดงรายการเรื่องร้องเรียนที่ผูกกับบัญชี LINE ของท่านโดยอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          {liffSession && myCases.length === 0 && (
            <section
              className="glass-panel mt-8 rounded-xl p-6 text-center shadow-sm"
              aria-labelledby="empty-cases-heading"
              data-testid="liff-empty-cases"
            >
              <h2 id="empty-cases-heading" className="text-lg font-semibold text-ink">
                ยังไม่มีรายการเรื่องแจ้งจากบัญชี LINE นี้
              </h2>
              <p className="mt-2 text-sm text-muted">
                หากท่านเคยแจ้งเรื่องผ่านระบบเดิมหรือมีเรื่องร้องทุกข์ใหม่ สามารถแจ้งเรื่องผ่านระบบได้ทันที
              </p>
              <div className="mt-5">
                <Link
                  href="/intake"
                  className="bg-accent-gradient shadow-accent-glow inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold text-on-accent"
                >
                  แจ้งเรื่องใหม่
                </Link>
              </div>
            </section>
          )}

          {myCases.length > 0 && (
            <section className="glass-panel mt-8 rounded-xl p-6 shadow-sm" aria-labelledby="my-cases-heading">
              <h2 id="my-cases-heading" className="text-xl font-semibold">
                {COPY.MY_CASES}{' '}
                <span className="text-sm font-normal text-muted">(จากบัญชี LINE ของท่าน)</span>
              </h2>
              <ul className="mt-4 space-y-3" data-testid="my-cases-list">
                {myCases.map((item) => (
                  <li key={item.trackingCode}>
                    <Link
                      href={`/track?id=${item.trackingCode}`}
                      className="border-border bg-surface-raised flex min-h-touch flex-col gap-1.5 rounded-lg border px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <CaseStatusBadge status={item.status} register="citizen" />
                        <span className="font-mono text-sm font-semibold text-accent-strong">{item.trackingCode}</span>
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-ink" title={item.title}>
                        {item.title}
                      </span>
                      <span className="text-xs text-muted">อัปเดต {formatThaiDateLong(new Date(item.updatedAt))}</span>
                    </Link>
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
