import { NextRequest } from 'next/server';
import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, lte, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, categories, departments, districts, provinces, subDistricts, users } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { isCaseStatus, OPEN_STATUSES, type CaseStatus } from '@/lib/cases/state-machine';
import { parseThaiDateEnd, parseThaiDateStart } from '@/lib/thai-date';
import { generateCasesCsv, type CaseExportRow } from '@/lib/cases/csv-export';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PRIORITIES = new Set(['normal', 'urgent']);
const MAX_EXPORT_LIMIT = 5000; // ป้องกัน memory overload

export async function GET(request: NextRequest) {
  const authz = await requireStaffApi();
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(request.url);
  const filters: ReturnType<typeof and>[] = [];

  const isOverdue = searchParams.get('overdue') === '1' || searchParams.get('overdue') === 'true';
  const statusParam = searchParams.get('status');
  const isOpenFilter = statusParam === 'open';
  const statusFilter: CaseStatus | null =
    statusParam && isCaseStatus(statusParam) ? statusParam : null;

  const priorityParam = searchParams.get('priority');
  const priorityFilter = priorityParam && VALID_PRIORITIES.has(priorityParam) ? priorityParam : null;
  const categoryFilter = searchParams.get('category');
  const fromStart = parseThaiDateStart(searchParams.get('from'));
  const toEnd = parseThaiDateEnd(searchParams.get('to'));
  const q = searchParams.get('q')?.trim() ?? '';

  if (isOverdue) {
    const now = new Date();
    filters.push(inArray(cases.status, OPEN_STATUSES));
    filters.push(isNotNull(cases.dueDate));
    filters.push(lt(cases.dueDate, now));
  } else if (isOpenFilter) {
    filters.push(inArray(cases.status, OPEN_STATUSES));
  } else if (statusFilter) {
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
  const db = await getDb();

  // Query พร้อม Left Joins
  const rows = await db
    .select({
      trackingCode: cases.trackingCode,
      createdAt: cases.createdAt,
      title: cases.title,
      description: cases.description,
      categoryName: categories.name,
      status: cases.status,
      priority: cases.priority,
      location: cases.location,
      village: cases.village,
      subDistrictNameTh: subDistricts.nameTh,
      districtNameTh: districts.nameTh,
      provinceNameTh: provinces.nameTh,
      departmentName: departments.name,
      assignedOfficerName: users.fullName,
      budgetStatus: cases.budgetStatus,
      budgetAmount: cases.budgetAmount,
      actionDetails: cases.actionDetails,
      dueDate: cases.dueDate,
      closedAt: cases.closedAt,
    })
    .from(cases)
    .leftJoin(categories, eq(cases.categoryId, categories.id))
    .leftJoin(departments, eq(cases.departmentId, departments.id))
    .leftJoin(users, eq(cases.assignedTo, users.id))
    .leftJoin(subDistricts, eq(cases.subDistrictId, subDistricts.id))
    .leftJoin(districts, eq(cases.districtId, districts.id))
    .leftJoin(provinces, eq(cases.provinceId, provinces.id))
    .where(where)
    .orderBy(desc(cases.createdAt))
    .limit(MAX_EXPORT_LIMIT);

  // บันทึก Audit Log การส่งออกข้อมูลตามระเบียบ PDPA
  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.CASE_EXPORT_CSV,
    resource: 'cases',
    metadata: {
      filterCount: filters.length,
      exportedRows: rows.length,
      query: Object.fromEntries(searchParams.entries()),
    },
  });

  const csvContent = generateCasesCsv(rows as CaseExportRow[]);
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `cases-report-${timestamp}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
