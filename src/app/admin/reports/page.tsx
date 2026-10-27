import Link from 'next/link';
import { AlertTriangle, Clock, ChevronRight, MapPin, Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { and, desc, eq, gte, ilike, lte, or, count, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, caseFeedback, categories, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { getActiveCategories } from '@/lib/queries/lookups';
import { AdminShell } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/admin/empty-state';
import { Pagination } from '@/components/admin/pagination';
import { CaseFilterBar } from '@/components/admin/case-filter-bar';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { OPEN_STATUSES, isCaseStatus, type CaseStatus } from '@/lib/cases/state-machine';
import { parseThaiDateEnd, parseThaiDateStart } from '@/lib/thai-date';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'จัดการเรื่อง' };

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const VALID_PRIORITIES = new Set(['normal', 'urgent']);

interface SearchParams {
  status?: string;
  category?: string;
  priority?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
}

function formatAge(date: Date, now: number): string {
  const diffHours = Math.floor((now - date.getTime()) / 3_600_000);
  if (diffHours < 1) return 'เมื่อครู่';
  if (diffHours < 24) return `${diffHours} ชม.`;
  return `${Math.floor(diffHours / 24)} วัน`;
}

export default async function CaseManagementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user: staffUser } = await requireStaff();
  const params = await searchParams;
  // § reconstruct current URL ฝั่ง server เพื่อส่งเป็น ?return= ให้หน้า detail
  const currentUrl =
    '/admin/reports?' +
    new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) =>
        v === undefined ? [] : [[k, Array.isArray(v) ? v[0] ?? '' : v]],
      ) as [string, string][],
    ).toString();
  const db = await getDb();

  // § parse + validate filter params (defense-in-depth — ไม่ trust input)
  const filters: ReturnType<typeof and>[] = [];
  const statusFilter: CaseStatus | null =
    params.status && isCaseStatus(params.status) ? params.status : null;
  const priorityFilter =
    params.priority && VALID_PRIORITIES.has(params.priority) ? params.priority : null;
  const categoryFilter = params.category ?? null;
  const fromStart = parseThaiDateStart(params.from);
  const toEnd = parseThaiDateEnd(params.to);
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  if (statusFilter) {
    filters.push(eq(cases.status, statusFilter));
  }
  if (priorityFilter) {
    filters.push(eq(cases.priority, priorityFilter as 'normal' | 'urgent'));
  }
  if (categoryFilter) {
    filters.push(eq(cases.categoryId, categoryFilter));
  }
  if (fromStart) {
    filters.push(gte(cases.createdAt, fromStart));
  }
  if (toEnd) {
    filters.push(lte(cases.createdAt, toEnd));
  }
  if (q) {
    // ILIKE สำหรับ case-insensitive search — postgres native
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(cases.title, pattern),
        ilike(cases.location, pattern),
        ilike(cases.id, pattern),
        ilike(cases.trackingCode, pattern),
      )!,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  // § นับ total สำหรับ pagination — ใช้ count query แยก (efficient)
  const totalRows = where
    ? await db.select({ c: count() }).from(cases).where(where)
    : await db.select({ c: count() }).from(cases);
  const total = totalRows[0]?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  // § fetch page ปัจจุบัน
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
    .where(where)
    .orderBy(desc(cases.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // fetch categories สำหรับ filter dropdown (active เท่านั้น)
  const categoryOptions = await getActiveCategories(db);

  // Server Component รันครั้งเดียวต่อ request — timestamp สดตอน render คือพฤติกรรมที่ต้องการจริง
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const queue = rows.map((row) => ({
    ...row,
    overSla:
      !!row.dueDate && now > row.dueDate.getTime() && OPEN_STATUSES.includes(row.status),
  }));

  // § สรุปยอด — นับจาก total queue ของหน้านี้เท่านั้น (ไม่ใช่ทั้งระบบ)
  // ถ้า filter active จะสรุปเฉพาะที่ filter แล้ว — สื่อสารใน label
  // § CSAT reader ขั้นต่ำ (interrogate: เก็บแล้วต้องมีคนอ่าน) — ค่าเฉลี่ยรวมทั้งระบบ
  const [fb] = await db
    .select({
      avg: sql<number | null>`avg(${caseFeedback.rating})`,
      count: count(),
    })
    .from(caseFeedback);
  const summary = {
    received: queue.filter((c) => c.status === 'received').length,
    open: queue.filter((c) => OPEN_STATUSES.includes(c.status)).length,
    overSla: queue.filter((c) => c.overSla).length,
    feedbackAvg: fb?.avg === null || fb?.avg === undefined ? null : Number(fb.avg).toFixed(1),
    feedbackCount: fb?.count ?? 0,
  };
  const isFiltered = !!(statusFilter || priorityFilter || categoryFilter || fromStart || toEnd || q);

  return (
    <AdminShell user={staffUser} active="reports" title="จัดการเรื่อง">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          คลิกที่เรื่องเพื่อดูรายละเอียด เปลี่ยนสถานะ หรือมอบหมาย
        </p>

        {/* สรุปยอดหน้านี้ */}
        <div className="glass-panel flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-4 py-3 text-sm text-muted shadow-sm">
          <span className="font-semibold text-ink">
            {isFiltered ? `สรุปหน้านี้ (กรองแล้ว)` : 'สรุป'}
          </span>
          <span>
            รับเรื่อง <strong className="text-ink">{summary.received}</strong>
          </span>
          <span>
            รอดำเนินการ <strong className="text-ink">{summary.open}</strong>
          </span>
          {summary.overSla > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-danger-ink">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              เลย SLA <strong>{summary.overSla}</strong>
            </span>
          )}
          {summary.feedbackAvg !== null && (
            <span>
              คะแนนเฉลี่ย <strong className="text-ink">★ {summary.feedbackAvg}</strong>{' '}
              ({summary.feedbackCount} ครั้ง)
            </span>
          )}
          <span className="ml-auto text-xs">
            ทั้งหมด <strong className="text-ink">{total.toLocaleString('th-TH')}</strong>{' '}
            เรื่อง · หน้า {page}/{totalPages}
          </span>
        </div>

        {/* Filter bar */}
        <CaseFilterBar categories={categoryOptions} />

        {/* คิวเรื่อง */}
        {queue.length === 0 ? (
          <div className="glass-panel rounded-xl shadow-sm">
            <EmptyState
              icon={Inbox}
              title={isFiltered ? 'ไม่พบเรื่องที่ตรงกับตัวกรอง' : 'ยังไม่มีเรื่องในระบบ'}
              description={
                isFiltered
                  ? 'ลองปรับตัวกรองหรือล้างเพื่อดูเรื่องทั้งหมด'
                  : 'เมื่อประชาชนแจ้งเรื่องใหม่ผ่านฟอร์ม เรื่องจะปรากฏที่นี่'
              }
              action={
                isFiltered ? (
                  <Link href="/admin/reports" className="text-sm font-semibold text-accent-strong hover:underline">
                    ล้างตัวกรอง
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="glass-panel overflow-hidden rounded-xl shadow-sm">
            <div className="hidden border-b border-border bg-surface-sunken/60 px-4 py-3 text-xs font-semibold text-muted sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto_auto] sm:gap-4">
              <span>เรื่อง</span>
              <span>หมวด</span>
              <span>ที่ตั้ง</span>
              <span>มอบหมาย</span>
              <span className="text-right">สถานะ · อายุ</span>
              {/* คอลัมน์ที่ 6 ของหัวตาราง — คู่กับ ChevronRight ท้ายแถว
                  เดิมประกาศ 5 คอลัมน์แต่แต่ละแถวมี 6 ช่อง ลูกศรจึงตกไปขึ้นแถวใหม่
                  ใต้ชื่อเรื่อง ทำให้ทุกแถวสูงเกินจริงและคอลัมน์เลื่อนไม่ตรงหัวตาราง */}
              <span aria-hidden="true" />
            </div>
            <ul>
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-border last:border-0"
                >
                  <Link
                    href={`/admin/cases/${item.id}?return=${encodeURIComponent(currentUrl)}`}
                    className={cn(
                      'block border-l-4 px-4 py-4 transition-colors duration-normal ease-out-expo',
                      'hover:bg-accent-sunken/60',
                      // แถบซ้ายแดงสำหรับเรื่องที่เลย SLA — สแกนหาได้ทันทีโดยไม่ต้องอ่าน
                      item.overSla ? 'border-l-danger' : 'border-l-transparent',
                      'sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto_auto] sm:items-center sm:gap-4',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">{item.id}</span>
                        {item.priority === 'urgent' ? (
                          <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-ink ring-1 ring-danger-ink/20 ring-inset">
                            ฉุกเฉิน
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate font-semibold text-ink">{item.title}</p>
                    </div>
                    <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                      {item.categoryName ?? '—'}
                    </span>
                    <span className="mt-1 hidden min-w-0 items-center gap-1 text-sm text-muted sm:mt-0 sm:flex">
                      <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                      <span className="truncate">{item.location}</span>
                    </span>
                    <span className="mt-1 hidden truncate text-sm text-muted sm:mt-0 sm:block">
                      {item.assigneeName ?? 'ยังไม่มอบหมาย'}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                      <CaseStatusBadge status={item.status} />
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap text-xs',
                          item.overSla ? 'font-semibold text-danger-ink' : 'text-muted',
                        )}
                      >
                        <Clock className="h-3 w-3 flex-none" aria-hidden="true" />
                        {formatAge(item.createdAt, now)}
                        {item.overSla ? ' · เลย SLA' : ''}
                      </span>
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/admin/reports"
          searchParams={params as Record<string, string | string[] | undefined>}
        />
      </div>
    </AdminShell>
  );
}
