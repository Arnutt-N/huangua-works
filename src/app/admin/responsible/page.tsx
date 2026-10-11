import type { Metadata } from 'next';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, departments, legacyResponsibleMap, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { STAFF_ROLES, SUPERADMIN_ONLY } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ResponsibleClient, type ResponsibleRow } from './responsible-client';

export const metadata: Metadata = { title: 'ผู้รับผิดชอบย้อนหลัง' };
export const dynamic = 'force-dynamic';

/**
 * /admin/responsible — mapping ผู้รับผิดชอบย้อนหลัง (superadmin เท่านั้น)
 *
 * ผูกค่าดิบคอลัมน์ผู้รับผิดชอบจากทะเบียน Excel กับหน่วยงานและเจ้าหน้าที่
 * 10 ค่าดิบตั้งต้นถูก seed ไว้แล้วโดย migration — หน้าที่นี้คือมาตัดสินทีละข้อ
 * แถวที่ยังไม่มีหน่วยงานหรือถูกปิดใช้ทำให้ dry-run ค้าง blocked ต่อไป
 */
export default async function ResponsiblePage() {
  const { user: staffUser } = await requireStaff(SUPERADMIN_ONLY);
  const db = await getDb();

  const mapRows = await db
    .select({
      raw: legacyResponsibleMap.raw,
      departmentId: legacyResponsibleMap.departmentId,
      departmentName: departments.name,
      assignedTo: legacyResponsibleMap.assignedTo,
      decidedBy: legacyResponsibleMap.decidedBy,
      decidedAt: legacyResponsibleMap.decidedAt,
      isActive: legacyResponsibleMap.isActive,
    })
    .from(legacyResponsibleMap)
    .leftJoin(departments, eq(legacyResponsibleMap.departmentId, departments.id))
    .orderBy(asc(legacyResponsibleMap.raw));

  const deptRows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(asc(departments.name));

  // § dropdown เจ้าหน้าที่มีเฉพาะ staff ที่ active — citizens ไม่ใช่ผู้รับผิดชอบงานได้
  const officerRows = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.isActive, true), inArray(users.role, [...STAFF_ROLES])))
    .orderBy(asc(users.fullName));

  const refRows = await db
    .select({ raw: cases.legacyResponsibleRaw, n: count() })
    .from(cases)
    .groupBy(cases.legacyResponsibleRaw);
  const refByRaw = new Map<string, number>();
  for (const r of refRows) {
    if (r.raw) refByRaw.set(r.raw, r.n);
  }

  const assigneeIds = [...new Set(mapRows.map((m) => m.assignedTo).filter((id): id is string => Boolean(id)))];
  const assigneeRows = assigneeIds.length
    ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, assigneeIds))
    : [];
  const assigneeById = new Map(assigneeRows.map((a) => [a.id, a.fullName]));

  const rows: ResponsibleRow[] = mapRows.map((m) => ({
    raw: m.raw,
    departmentId: m.departmentId,
    departmentName: m.departmentName,
    assignedTo: m.assignedTo,
    assigneeName: m.assignedTo ? (assigneeById.get(m.assignedTo) ?? null) : null,
    decidedBy: m.decidedBy,
    decidedAt: m.decidedAt,
    isActive: m.isActive,
    isSeed: m.decidedBy === 'system',
    referencedCount: refByRaw.get(m.raw) ?? 0,
  }));

  return (
    <AdminShell user={staffUser} active="responsible" title="ผู้รับผิดชอบย้อนหลัง">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ตัดสินค่าดิบจากทะเบียน Excel ทีละข้อ — ข้อที่ยังไม่มีหน่วยงานหรือถูกปิดใช้จะไม่ถูกนำเข้า
        </p>
        <ResponsibleClient rows={rows} departments={deptRows} officers={officerRows} />
      </div>
    </AdminShell>
  );
}
