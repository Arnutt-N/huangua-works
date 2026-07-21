import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, MapPin, User, Users } from 'lucide-react';
import { and, asc, eq, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import {
  cases,
  caseUpdates,
  categories,
  departments,
  users,
} from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { STATUS_LABELS_TH } from '@/lib/cases/state-machine';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CaseDetailClient, SuccessToast } from './case-detail-client';

export const metadata: Metadata = { title: 'รายละเอียดเรื่อง' };

// § force-dynamic: ต้อง auth + query DB ต่อ request + ข้อมูลต้องสด (real-time)
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}

const SUPERVISOR_ROLES = ['chief', 'head', 'superadmin'] as const;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function formatAge(date: Date, now: number): string {
  const diffHours = Math.floor((now - date.getTime()) / 3_600_000);
  if (diffHours < 1) return 'เมื่อครู่';
  if (diffHours < 24) return `${diffHours} ชม.`;
  return `${Math.floor(diffHours / 24)} วัน`;
}

export default async function CaseDetailPage({ params, searchParams }: PageProps) {
  const { user: staffUser } = await requireStaff();
  const { id: caseId } = await params;
  const { ok } = await searchParams;

  const db = await getDb();

  // fetch case + relations ใน query เดียว (leftJoin เพราะไม่มี Drizzle relations())
  const caseRow = await firstOrUndefined(
    db
      .select({
        id: cases.id,
        trackingCode: cases.trackingCode,
        title: cases.title,
        description: cases.description,
        location: cases.location,
        status: cases.status,
        priority: cases.priority,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        dueDate: cases.dueDate,
        closedAt: cases.closedAt,
        categoryId: cases.categoryId,
        categoryName: categories.name,
        submittedBy: cases.submittedBy,
        submitterName: users.fullName,
        submitterPhone: users.phoneNumber,
        assignedTo: cases.assignedTo,
        assigneeName: users.fullName,
        departmentId: cases.departmentId,
        departmentName: departments.name,
      })
      .from(cases)
      .leftJoin(categories, eq(cases.categoryId, categories.id))
      .leftJoin(departments, eq(cases.departmentId, departments.id))
      .leftJoin(users, eq(cases.submittedBy, users.id))
      // § 2nd join to users for assignee — alias ไม่ได้ใน core query, ใช้ subquery แยกแทน (ด้านล่าง)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!caseRow) {
    notFound();
  }

  // fetch assignee name แยก (เพราะ join users 2 ครั้งใน query เดียวไม่ได้ใน core builder)
  let assigneeName: string | null = null;
  if (caseRow.assignedTo) {
    const assignee = await firstOrUndefined(
      db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, caseRow.assignedTo))
        .limit(1)
    );
    assigneeName = assignee?.fullName ?? null;
  }

  // fetch timeline (case_updates) — ทั้ง public + internal (เจ้าหน้าที่เห็นได้หมด)
  const timeline = await db
    .select({
      id: caseUpdates.id,
      createdAt: caseUpdates.createdAt,
      updateType: caseUpdates.updateType,
      oldValue: caseUpdates.oldValue,
      newValue: caseUpdates.newValue,
      comment: caseUpdates.comment,
      isPublic: caseUpdates.isPublic,
      userId: caseUpdates.userId,
    })
    .from(caseUpdates)
    .where(eq(caseUpdates.caseId, caseId))
    .orderBy(asc(caseUpdates.createdAt));

  // fetch timeline actor names ทีเดียว (batch lookup)
  const actorIds = [...new Set(timeline.map((t) => t.userId))];
  const actorRows =
    actorIds.length === 0
      ? []
      : await db
          .select({ id: users.id, fullName: users.fullName, role: users.role })
          .from(users)
          .where(
            // Drizzle ไม่มี inArray ใน core builder แบบนี้ — ใช้ or() chain
            // แต่ถ้า actor เยอะจะ verbose; สำหรับ case detail มักมีไม่กี่ actor
            actorIds.length === 1
              ? eq(users.id, actorIds[0]!)
              : eq(users.id, actorIds[0]!)
          );
  // fallback: query ทีละ id ถ้ามีหลาย actor (rare for single case)
  if (actorIds.length > 1) {
    const more = await Promise.all(
      actorIds.slice(1).map((id) =>
        firstOrUndefined(
          db.select({ id: users.id, fullName: users.fullName, role: users.role }).from(users).where(eq(users.id, id)).limit(1)
        )
      )
    );
    actorRows.push(...more.filter((r): r is NonNullable<typeof r> => !!r));
  }
  const actorMap = new Map(actorRows.map((a) => [a.id, a]));

  // fetch officers ในระบบ (active, role != citizen) สำหรับ dropdown มอบหมาย
  const officers = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, departmentId: users.departmentId })
    .from(users)
    .where(and(eq(users.isActive, true), ne(users.role, 'citizen')))
    .orderBy(users.fullName);

  // filter officers: เจ้าหน้าที่ทั่วไปเห็นทุกคน (admin สามารถมอบหมายข้ามหน่วยงานได้ใน MVP)
  const officerOptions = officers.map((o) => ({
    id: o.id,
    fullName: o.fullName,
    role: o.role,
  }));

  // fetch departments สำหรับ dropdown (เฉพาะ active)
  const deptRows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(departments.name);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const canChangeDepartment = SUPERVISOR_ROLES.includes(
    staffUser.role as (typeof SUPERVISOR_ROLES)[number]
  );

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} active="dashboard" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* breadcrumb */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        กลับไปแดชบอร์ด
      </Link>

      <SuccessToast ok={ok ?? null} />

      {/* หัวเรื่อง + meta */}
      <header className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-mono">{caseRow.id}</span>
              {caseRow.trackingCode && (
                <span className="rounded-pill bg-accent-sunken px-2 py-0.5 font-mono font-semibold text-accent-strong">
                  {caseRow.trackingCode}
                </span>
              )}
              {caseRow.priority === 'urgent' && (
                <span className="rounded-pill bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                  ฉุกเฉิน
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              {caseRow.title}
            </h1>
          </div>
          <CaseStatusBadge status={caseRow.status} />
        </div>

        {/* meta grid */}
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem icon={<Calendar className="h-4 w-4" />} label="วันที่รับเรื่อง">
            {formatDateTime(caseRow.createdAt)}
            <span className="ml-1 text-muted">
              ({formatAge(caseRow.createdAt, now)})
            </span>
          </MetaItem>
          {caseRow.dueDate && (
            <MetaItem icon={<Clock className="h-4 w-4" />} label="กำหนดเสร็จ">
              {formatDateTime(caseRow.dueDate)}
            </MetaItem>
          )}
          {caseRow.categoryName && (
            <MetaItem label="หมวดหมู่">{caseRow.categoryName}</MetaItem>
          )}
          {caseRow.departmentName && (
            <MetaItem label="หน่วยงาน">{caseRow.departmentName}</MetaItem>
          )}
          {assigneeName && (
            <MetaItem icon={<User className="h-4 w-4" />} label="ผู้รับผิดชอบ">
              {assigneeName}
            </MetaItem>
          )}
          {caseRow.submitterName && (
            <MetaItem icon={<Users className="h-4 w-4" />} label="ผู้แจ้ง">
              {caseRow.submitterName}
            </MetaItem>
          )}
        </dl>

        {/* location + description */}
        <div className="mt-6 space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-bold text-muted">ที่ตั้ง</h2>
            <p className="flex items-start gap-2 text-sm text-ink">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
              {caseRow.location}
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-bold text-muted">รายละเอียด</h2>
            <p className="whitespace-pre-wrap text-sm text-ink">{caseRow.description}</p>
          </div>
        </div>
      </header>

      <hr className="my-8 border-border" />

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* ซ้าย: actions */}
        <section aria-label="การจัดการเรื่อง">
          <h2 className="mb-4 text-lg font-bold text-ink">การจัดการเรื่อง</h2>
          <CaseDetailClient
            caseId={caseRow.id}
            currentStatus={caseRow.status}
            currentPriority={caseRow.priority}
            currentAssignedTo={caseRow.assignedTo}
            currentDepartmentId={caseRow.departmentId}
            officers={officerOptions}
            departments={deptRows}
            canChangeDepartment={canChangeDepartment}
          />
        </section>

        {/* ขวา: timeline */}
        <section aria-label="ไทม์ไลน์">
          <h2 className="mb-4 text-lg font-bold text-ink">ไทม์ไลน์</h2>
          {timeline.length === 0 ? (
            <p className="rounded-md border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
              ยังไม่มีความคืบหน้า — เริ่มด้วยการเปลี่ยนสถานะหรือเพิ่มความคืบ
            </p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((entry) => {
                const actor = actorMap.get(entry.userId);
                return (
                  <li
                    key={entry.id}
                    className="rounded-md border border-border bg-surface-raised p-4"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs text-muted">
                      <span>
                        {actor?.fullName ?? 'ระบบ'} ·{' '}
                        <span className="font-medium">{entry.updateType}</span>
                      </span>
                      <time dateTime={entry.createdAt.toISOString()}>
                        {formatDateTime(entry.createdAt)}
                      </time>
                    </div>
                    <div className="mt-2 text-sm text-ink">
                      {entry.updateType === 'status_change' && (
                        <p>
                          {entry.oldValue && STATUS_LABELS_TH[entry.oldValue as keyof typeof STATUS_LABELS_TH]
                            ? STATUS_LABELS_TH[entry.oldValue as keyof typeof STATUS_LABELS_TH]
                            : entry.oldValue}
                          {' → '}
                          {entry.newValue && STATUS_LABELS_TH[entry.newValue as keyof typeof STATUS_LABELS_TH]
                            ? STATUS_LABELS_TH[entry.newValue as keyof typeof STATUS_LABELS_TH]
                            : entry.newValue}
                        </p>
                      )}
                      {entry.updateType === 'assignment' && (
                        <p>
                          มอบหมาย: {entry.oldValue} → {entry.newValue}
                        </p>
                      )}
                      {entry.comment && (
                        <p className="mt-1 whitespace-pre-wrap">{entry.comment}</p>
                      )}
                      {!entry.isPublic && (
                        <span className="mt-2 inline-block rounded-pill bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                          ภายใน
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
      </main>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs font-semibold text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}
