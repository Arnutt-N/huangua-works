import Link from 'next/link';
import { AlertTriangle, Clock, ChevronRight, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, categories, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { CaseStatusBadge, type CaseStatus } from '@/components/ui/case-status-badge';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'แดชบอร์ดเจ้าหน้าที่' };

// § force-dynamic: หน้านี้ query cases/users/departments จาก DB + ตรวจ session ต่อ request
// ห้ามให้ Next.js prerender เป็น static HTML ตอน build — build machine จะต้องต่อ DB และ auth
// ณ build-time (session ไม่มีตอน build) → พังทุกครั้ง ทั้ง cases ยังต้องสดใหม่ real-time
export const dynamic = 'force-dynamic';

/**
 * /admin — แดชบอร์ดเจ้าหน้าที่ (Auth.js v5 + ข้อมูลเคสจริง)
 *
 * Auth: requireStaff() ตรวจ session + re-fetch user row + role/isActive check
 * (defense in depth — JWT เป็น snapshot ตอน login)
 *
 * Filter UI จะผูก logic จริงใน PR #3 — ตอนนี้คลิกที่แถวเคสเพื่อดู detail ได้
 */

function formatAge(date: Date, now: number): string {
  const diffHours = Math.floor((now - date.getTime()) / 3_600_000);
  if (diffHours < 1) return 'เมื่อครู่';
  if (diffHours < 24) return `${diffHours} ชม.`;
  return `${Math.floor(diffHours / 24)} วัน`;
}

const OPEN_STATUSES: CaseStatus[] = ['received', 'reviewing', 'assigned', 'in_progress'];

export default async function AdminDashboardPage() {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  const rows = await db
    .select({
      id: cases.id,
      title: cases.title,
      location: cases.location,
      status: cases.status,
      priority: cases.priority,
      createdAt: cases.createdAt,
      dueDate: cases.dueDate,
      categoryName: categories.name,
      assigneeName: users.fullName,
    })
    .from(cases)
    .leftJoin(categories, eq(cases.categoryId, categories.id))
    .leftJoin(users, eq(cases.assignedTo, users.id))
    .orderBy(desc(cases.createdAt))
    .limit(100);

  // Server Component รันครั้งเดียวต่อ request — timestamp สดตอน render คือพฤติกรรมที่ต้องการจริง
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const queue = rows.map((row) => ({
    ...row,
    overSla: !!row.dueDate && now > row.dueDate.getTime() && OPEN_STATUSES.includes(row.status),
  }));

  const summary = {
    received: queue.filter((c) => c.status === 'received').length,
    open: queue.filter((c) => OPEN_STATUSES.includes(c.status)).length,
    overSla: queue.filter((c) => c.overSla).length,
  };

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* หัวแดชบอร์ด */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">แดชบอร์ดเจ้าหน้าที่</h1>
            <p className="mt-2 text-sm text-muted">
              คลิกที่เรื่องเพื่อดูรายละเอียด เปลี่ยนสถานะ หรือมอบหมาย
            </p>
          </div>
        </div>

        {/* สรุปวันนี้ (จากชุดข้อมูลที่ดึงมา — ไม่ใช่นับทั้งระบบถ้าเกิน 100 เคส) */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">สรุป</span>
          <span>
            รับเรื่อง <strong className="text-ink">{summary.received}</strong>
          </span>
          <span>
            รอดำเนินการ <strong className="text-ink">{summary.open}</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            เลย SLA <strong>{summary.overSla}</strong>
          </span>
        </div>

        {/* คิวเรื่อง — คลิกได้ไป detail page */}
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface-raised">
          <div className="hidden border-b border-border px-4 py-3 text-xs font-semibold text-muted sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto] sm:gap-4">
            <span>เรื่อง</span>
            <span>หมวด</span>
            <span>ที่ตั้ง</span>
            <span>มอบหมาย</span>
            <span className="text-right">สถานะ · อายุ</span>
          </div>
          {queue.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted">ยังไม่มีเรื่องในระบบ</p>
          ) : (
            <ul>
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-surface-sunken/50"
                >
                  <Link
                    href={`/admin/cases/${item.id}`}
                    className="block px-4 py-4 transition-colors duration-normal ease-out-expo sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">{item.id}</span>
                        {item.priority === 'urgent' ? (
                          <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                            ฉุกเฉิน
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate font-semibold text-ink">{item.title}</p>
                    </div>
                    <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                      {item.categoryName ?? '—'}
                    </span>
                    <span className="mt-1 hidden items-center gap-1 text-sm text-muted sm:mt-0 sm:flex">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="truncate">{item.location}</span>
                    </span>
                    <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                      {item.assigneeName ?? 'ยังไม่มอบหมาย'}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                      <CaseStatusBadge status={item.status} />
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          item.overSla ? 'font-semibold text-danger' : 'text-muted',
                        )}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatAge(item.createdAt, now)}
                        {item.overSla ? ' · เลย SLA' : ''}
                      </span>
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
