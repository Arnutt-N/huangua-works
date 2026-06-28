import { ArrowLeft, CheckCircle2, Clock, MapPin, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CaseStatusBadge, type CaseStatus } from '../../components/ui/case-status-badge';
import { Button } from '../../components/ui/button';
import { FieldHint, Input, Label } from '../../components/ui/field';
import { SiteHeader } from '../../components/site/site-header';
import { SiteFooter } from '../../components/site/site-footer';
import { cn } from '../../lib/cn';

export const metadata: Metadata = { title: 'ติดตามเรื่อง' };

/**
 * /track — ค้นหาและดูสถานะเรื่อง (UI skeleton)
 * ช่องค้นหา (เลขติดตาม / บัตร 13 หลัก) + ผลลัพธ์ตัวอย่าง (CaseStatusBadge + timeline)
 * ยังไม่ค้นจริก (P0 + Supabase) ผลด้านล่างเป็น mock
 */

interface TimelineStep {
  status: CaseStatus;
  label: string;
  at: string;
  done: boolean;
  current?: boolean;
}

const timeline: TimelineStep[] = [
  { status: 'received', label: 'รับเรื่อง', at: '5 มิ.ย. 2568 · 14:20 น.', done: true },
  { status: 'reviewing', label: 'ตรวจสอบ', at: '5 มิ.ย. 2568 · 16:05 น.', done: true },
  { status: 'in_progress', label: 'ดำเนินการ', at: '6 มิ.ย. 2568 · 09:30 น.', done: true, current: true },
  { status: 'done', label: 'ปิดเรื่อง', at: 'รอดำเนินการ', done: false },
];

export default function TrackPage() {
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
        <p className="mt-3 text-lg text-muted">
          กรอกเลขติดตาม หรือเลขบัตรประชาชน เพื่อดูสถานะเรื่องที่ท่านแจ้ง
        </p>

        {/* ช่องค้นหา */}
        <div className="mt-8 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
          <Label htmlFor="trackId">เลขติดตาม</Label>
          <Input id="trackId" placeholder="เช่น HN-2568-000123" />
          <div className="my-4 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            หรือ
            <span className="h-px flex-1 bg-border" />
          </div>
          <Label htmlFor="trackCid">เลขบัตรประชาชน 13 หลัก</Label>
          <Input id="trackCid" inputMode="numeric" placeholder="x-xxxx-xxxxx-xx-x" />
          <Button type="button" className="mt-5 w-full sm:w-auto">
            <Search className="h-5 w-5" aria-hidden="true" />
            ค้นหาเรื่อง
          </Button>
          <FieldHint>ผลด้านล่างเป็นตัวอย่าง ยังไม่เชื่อมฐานข้อมูลจริง</FieldHint>
        </div>

        {/* ผลลัพธ์ตัวอย่าง */}
        <section aria-labelledby="result" className="mt-10">
          <h2 id="result" className="text-xl font-semibold">
            เรื่องตัวอย่าง
          </h2>
          <div className="mt-4 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">
                  เลขติดตาม <span className="font-semibold text-ink">HN-2568-000123</span>
                </p>
                <h3 className="mt-1 text-lg font-semibold">ถนนบ้านหนองโน เป็นหลุมเป็นบ่อ</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    บ.หนองโน
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    แจ้ง 5 มิ.ย. 2568
                  </span>
                </p>
              </div>
              <CaseStatusBadge status="in_progress" />
            </div>

            <ol className="relative mt-6">
              <span
                aria-hidden="true"
                className="absolute bottom-2 left-[1.375rem] top-2 w-px bg-border"
              />
              {timeline.map(({ status, label, at, done, current }) => (
                <li key={label} className="relative pb-6 last:pb-0">
                  <div className="flex gap-4">
                    <span
                      className={cn(
                        'relative z-10 flex h-11 w-11 flex-none items-center justify-center rounded-full ring-1',
                        current
                          ? 'bg-accent-strong text-on-accent ring-accent-strong'
                          : done
                            ? 'bg-success-soft text-success ring-success/30'
                            : 'bg-surface-sunken text-muted ring-border',
                      )}
                    >
                      {done && !current ? (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                      )}
                    </span>
                    <div className="pt-1.5">
                      <CaseStatusBadge status={status} label={label} />
                      <p className="mt-1 text-sm text-muted">{at}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}