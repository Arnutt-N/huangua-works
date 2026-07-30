import { and, eq, ne } from 'drizzle-orm';
import { getDb, type Db } from '../db';
import { categories, departments, users } from '../db/schema';
import type { UserRole } from '../auth/roles';

export interface OptionRow {
  id: string;
  name: string;
}

export interface OfficerRow {
  id: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
}

export async function getActiveDepartments(db?: Db): Promise<OptionRow[]> {
  const _db = db ?? (await getDb());
  return _db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(departments.name);
}

export async function getActiveCategories(db?: Db): Promise<OptionRow[]> {
  const _db = db ?? (await getDb());
  return _db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.name);
}

export async function getActiveOfficers(db?: Db): Promise<OfficerRow[]> {
  const _db = db ?? (await getDb());
  return _db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      departmentId: users.departmentId,
    })
    .from(users)
    .where(and(eq(users.isActive, true), ne(users.role, 'citizen')))
    .orderBy(users.fullName);
}
