import type { Metadata } from 'next';
import { desc, eq, ilike, or, count, and } from 'drizzle-orm';
import { ScrollText, Globe, Fingerprint, Clock, FileJson } from 'lucide-react';
import { getDb } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import { AdminCard } from '@/components/admin/admin-card';
import { EmptyState } from '@/components/admin/empty-state';
import { Pagination } from '@/components/admin/pagination';
import { RoleBadge } from '@/components/admin/role-badge';
import { AuditFilterBar } from './audit-filter-bar';

export const metadata: Metadata = { title: 'ประวัติการกระทำ' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface SearchParams {
  action?: string;
  resource?: string;
  q?: string;
  page?: string;
}

const VALID_RESOURCES = new Set([
  'cases',
  'users',
  'auth',
  'departments',
  'consent',
  'categories',
]);

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user: staffUser } = await requireStaff();
  const params = await searchParams;
  const db = await getDb();

  // § parse filters
  const actionFilter = params.action?.trim() || null;
  const resourceFilter =
    params.resource && VALID_RESOURCES.has(params.resource) ? params.resource : null;
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  // § build where conditions
  const filters: ReturnType<typeof and>[] = [];
  if (actionFilter) {
    filters.push(eq(auditLogs.action, actionFilter));
  }
  if (resourceFilter) {
    filters.push(eq(auditLogs.resource, resourceFilter));
  }
  if (q) {
    // search by user email/name via sub-query OR by resourceId/IP
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(users.email, pattern),
        ilike(users.fullName, pattern),
        ilike(auditLogs.ipAddress, pattern),
        ilike(auditLogs.resourceId, pattern),
      )!,
    );
  }

  // For the count + data query, we need leftJoin users for the search
  const where = filters.length > 0 ? and(...filters) : undefined;

  // § count total
  const totalRows = where
    ? await db
        .select({ c: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
    : await db.select({ c: count() }).from(auditLogs);
  const total = totalRows[0]?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  // § fetch page
  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      metadata: auditLogs.metadata,
      userId: auditLogs.userId,
      userName: users.fullName,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // § fetch distinct actions สำหรับ filter dropdown
  const distinctActions = await db
    .select({ action: auditLogs.action })
    .from(auditLogs)
    .groupBy(auditLogs.action)
    .orderBy(auditLogs.action);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} active="audit" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <AdminPageTransition>
          <div className="space-y-6">
            <AdminPageHeader
              title="ประวัติการกระทำ"
              subtitle="บันทึกการเข้าถึงและเปลี่ยนแปลงข้อมูล (PDPA compliance audit trail)"
            />

            <AuditFilterBar actions={distinctActions.map((a) => a.action)} />

            <p className="text-sm text-muted">
              ทั้งหมด {total.toLocaleString('th-TH')} รายการ · หน้า {page}/{totalPages}
            </p>

            {rows.length === 0 ? (
              <AdminCard>
                <EmptyState
                  icon={ScrollText}
                  title="ไม่มีประวัติ"
                  description="ยังไม่มีการกระทำที่ถูกบันทึก หรือไม่ตรงกับตัวกรอง"
                />
              </AdminCard>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <AdminCard key={row.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Action + resource */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-pill bg-accent-sunken px-3 py-0.5 text-xs font-semibold text-accent-strong">
                            {row.action}
                          </span>
                          <span className="text-xs text-muted">
                            resource: <code className="font-mono text-ink">{row.resource}</code>
                            {row.resourceId && (
                              <>
                                {' '}· id:{' '}
                                <code className="font-mono text-ink">{row.resourceId}</code>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Actor */}
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {row.userName ? (
                            <>
                              <span className="font-semibold text-ink">{row.userName}</span>
                              <span className="text-muted">({row.userEmail})</span>
                              {row.userRole && <RoleBadge role={row.userRole} />}
                            </>
                          ) : (
                            <span className="text-muted">system (no user)</span>
                          )}
                        </div>

                        {/* Meta: IP + time */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDateTime(row.createdAt)}
                          </span>
                          {row.ipAddress && (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                              <code className="font-mono">{row.ipAddress}</code>
                            </span>
                          )}
                          {row.userAgent && (
                            <span className="inline-flex items-center gap-1" title={row.userAgent}>
                              <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="max-w-[200px] truncate">{row.userAgent}</span>
                            </span>
                          )}
                        </div>

                        {/* Metadata (expandable) */}
                        {row.metadata != null && (
                          <details className="group">
                            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-strong hover:underline">
                              <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                              metadata
                              <span className="text-muted group-open:hidden">(แสดง)</span>
                              <span className="hidden text-muted group-open:inline">(ซ่อน)</span>
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs text-ink">
                              <code>{formatMetadata(row.metadata)}</code>
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </AdminCard>
                ))}
              </div>
            )}

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/admin/audit"
              searchParams={params as Record<string, string | string[] | undefined>}
            />
          </div>
        </AdminPageTransition>
      </main>
    </div>
  );
}

/**
 * metadata ใน DB เก็บเป็น jsonb — Drizzle คืนเป็น string (JSON-encoded) หรือ object
 * ขึ้นกับ driver config — format ให้อ่านง่าย
 */
function formatMetadata(metadata: unknown): string {
  if (typeof metadata === 'string') {
    try {
      return JSON.stringify(JSON.parse(metadata), null, 2);
    } catch {
      return metadata;
    }
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}
