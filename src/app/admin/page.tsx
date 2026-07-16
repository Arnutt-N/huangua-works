import { AlertTriangle, Clock, Filter, LogOut, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { auth, signOut } from '@/auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, categories, departments, users } from '@/lib/db/schema';
import { logout } from './actions';
import { SiteHeader } from '../../components/site/site-header';
import { SiteFooter } from '../../components/site/site-footer';
import { Button } from '../../components/ui/button';
import { CaseStatusBadge, type CaseStatus } from '../../components/ui/case-status-badge';
import { Input, Label } from '../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../lib/cn';

export const metadata: Metadata = { title: 'แดชบอร์ดเจ้าหน้าที่' };

/**
 * /admin — แดชบอร์ดเจ้าหน้าที่ (เชื่อม Auth.js v5 + ข้อมูลเคสจริง)
 * middleware.ts เช็ค session เบื้องต้น — หน้านี้เช็คซ้ำ + เช็ค role/isActive ตาม users table
 * (defense in depth: session อาจยังอยู่แม้ role/isActive เปลี่ยนไปหลัง login)
 * ยังไม่มีปุ่มแก้ไข/มอบหมายเคส, filter ยังเป็น UI เฉยๆ (descoped — ดู BACKLOG.md)
 */

const statusFilters = [
  'ทั้งหมด',
  'รับเรื่อง',
  'ตรวจสอบ',
  'มอบหมาย',
  'ดำเนินการ',
  'เสร็จ',
  'ปิดเรื่อง',
] as const;

const catFilters = ['ทั้งหมด'] as const;
const urgencyFilters = ['ทั้งหมด', 'ปกติ', 'ฉุกเฉิน'] as const;

function FilterSelect({
  id,
  label,
  options,
}: {
  id: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select>
        <SelectTrigger id={id}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatAge(date: Date, now: number): string {
  const diffHours = Math.floor((now - date.getTime()) / 3_600_000);
  if (diffHours < 1) return 'เมื่อครู่';
  if (diffHours < 24) return `${diffHours} ชม.`;
  return `${Math.floor(diffHours / 24)} วัน`;
}

const OPEN_STATUSES: CaseStatus[] = ['received', 'reviewing', 'assigned', 'in_progress'];

export default async function AdminDashboardPage() {
  // § auth() อ่าน session จาก JWT cookie (ไม่ติด DB ตอน decode)
  const session = await auth();
  if (!session?.user.userId) redirect('/admin/login');

  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.id, session.user.userId)).limit(1)
  );

  if (!staffUser || staffUser.role === 'citizen' || !staffUser.isActive) {
    // § session ยัง valid แต่ role/isActive ไม่ผ่าน — เกิดขึ้นได้เมื่อบัญชีถูกระงับ
    // หลัง login ไปแล้ว sensitive กว่าการ login ครั้งแรกไม่ผ่าน ต้อง audit เหมือนกัน
    // § ต้อง signOut ก่อน redirect ไม่งั้น cookie ยังอยู่ → proxy bounce กลับ /admin จาก
    // /admin/login → วนลูปไม่รู้จบ (H1 จาก code review) — เหมือนที่ actions.ts ทำตอน login
    await signOut({ redirect: false });
    await logAudit({
      action: 'access_denied',
      resource: 'auth',
      userId: staffUser?.id,
      metadata: {
        reason: !staffUser ? 'no_staff_record' : staffUser.role === 'citizen' ? 'citizen_role' : 'inactive',
      },
    });
    redirect('/admin/login');
  }

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
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* หัวแดชบอร์ด + ผู้ใช้ปัจจุบัน + ออกจากระบบ */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">แดชบอร์ดเจ้าหน้าที่</h1>
            <p className="mt-2 text-sm text-muted">
              คิวเรื่องร้องเรียก/ร้องทุกข์ พร้อมสถานะ มอบหมาย และ SLA
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-semibold text-ink">{staffUser.fullName}</p>
              <p className="text-muted">{staffUser.role}</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="secondary">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                ออกจากระบบ
              </Button>
            </form>
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

        {/* ตัวกรอง (ยังไม่ผูก logic จริง) */}
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <Label htmlFor="q" className="sr-only">
              ค้นหา
            </Label>
            <Input id="q" placeholder="ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง" />
          </div>
          <FilterSelect id="f-status" label="สถานะ" options={statusFilters} />
          <FilterSelect id="f-cat" label="หมวด" options={catFilters} />
          <Button type="button" variant="secondary">
            <Filter className="h-4 w-4" aria-hidden="true" />
            กรอง
          </Button>
        </div>
        <div className="mt-3">
          <FilterSelect id="f-urgency" label="ความเร่งด่วน" options={urgencyFilters} />
        </div>

        {/* คิวเรื่อง (data list) */}
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
                  className="border-b border-border px-4 py-4 transition-colors duration-normal ease-out-expo last:border-0 hover:bg-surface-sunken/50 sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto] sm:items-center sm:gap-4"
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
                    {item.location}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
