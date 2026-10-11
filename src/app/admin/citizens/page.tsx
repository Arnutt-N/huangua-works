import type { Metadata } from 'next';
import { and, asc, count, eq, ilike, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, lineUsers, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { SUPERADMIN_ONLY } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { CitizensClient, type CitizenRow } from './citizens-client';

export const metadata: Metadata = { title: 'จัดการบัญชีประชาชน' };
export const dynamic = 'force-dynamic';

/**
 * /admin/citizens — บัญชีประชาชน (superadmin เท่านั้น)
 *
 * บัญชีเหล่านี้ไม่มีรหัสผ่าน (identity ผูกกับ CID/LINE/legacy placeholder)
 * จึงไม่มีสร้าง/รีเซ็ตรหัสผ่าน — มีแค่ค้น แก้ไขข้อมูลติดต่อ เปิด/ปิดใช้ ผูกเลขบัตร
 * ถอดผูก LINE และลบ (ลบได้เฉพาะบัญชีที่ไม่มีเรื่องอ้างถึง)
 */
export default async function CitizensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user: staffUser } = await requireStaff(SUPERADMIN_ONLY);
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const db = await getDb();

  // § escape wildcard ของ ilike — คำค้นที่มี % _ \ ต้องตรงตัวอักษร ไม่ใช่ pattern
  const escaped = query.replace(/[\\%_]/g, (m) => `\\${m}`);
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phoneNumber: users.phoneNumber,
      metadata: users.metadata,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      query
        ? and(eq(users.role, 'citizen'), ilike(users.fullName, `%${escaped}%`))
        : eq(users.role, 'citizen'),
    )
    .orderBy(asc(users.fullName))
    .limit(200);

  const ids = userRows.map((r) => r.id);
  const links = ids.length
    ? await db
        .select({
          linkedUserId: lineUsers.linkedUserId,
          lineUserId: lineUsers.lineUserId,
          displayName: lineUsers.displayName,
        })
        .from(lineUsers)
        .where(inArray(lineUsers.linkedUserId, ids))
    : [];
  const counts = ids.length
    ? await db
        .select({ submittedBy: cases.submittedBy, n: count() })
        .from(cases)
        .where(inArray(cases.submittedBy, ids))
        .groupBy(cases.submittedBy)
    : [];
  const linksByUser = new Map<string, { lineUserId: string; displayName: string | null }[]>();
  for (const l of links) {
    if (!l.linkedUserId) continue;
    const arr = linksByUser.get(l.linkedUserId) ?? [];
    arr.push({ lineUserId: l.lineUserId, displayName: l.displayName });
    linksByUser.set(l.linkedUserId, arr);
  }
  const countsByUser = new Map(counts.map((c) => [c.submittedBy, c.n]));

  const rows: CitizenRow[] = userRows.map((r) => {
    const meta = typeof r.metadata === 'object' && r.metadata !== null && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {};
    const contactEmail = typeof meta.contactEmail === 'string' ? meta.contactEmail : null;
    return {
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      phoneNumber: r.phoneNumber,
      contactEmail,
      isActive: r.isActive,
      createdAt: r.createdAt,
      lineLinks: linksByUser.get(r.id) ?? [],
      caseCount: countsByUser.get(r.id) ?? 0,
    };
  });

  return (
    <AdminShell user={staffUser} active="citizens" title="จัดการบัญชีประชาชน">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ค้นและจัดการบัญชีประชาชน — แก้ไขข้อมูลติดต่อ เปิด/ปิดใช้งาน ผูกเลขบัตรประชาชน
          ถอดการผูก LINE และลบ (ลบได้เฉพาะบัญชีที่ไม่มีเรื่องแจ้งอ้างถึง)
        </p>

        <form method="get" className="flex max-w-md items-center gap-2" role="search">
          <Input
            name="q"
            defaultValue={query}
            maxLength={100}
            placeholder="ค้นหาด้วยชื่อ..."
            aria-label="ค้นหาประชาชนด้วยชื่อ"
          />
          <Button type="submit" size="sm">
            <Search className="h-4 w-4" aria-hidden="true" />
            ค้นหา
          </Button>
        </form>

        <CitizensClient rows={rows} query={query} />
      </div>
    </AdminShell>
  );
}
