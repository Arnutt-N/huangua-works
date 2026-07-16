/**
 * GET /api/categories — ดึงหมวดหมู่ทั้งหมด (สำหรับ dropdown ในฟอร์มแจ้งเรื่อง)
 * Public endpoint
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const db = await getDb();

  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.name);

  return NextResponse.json({
    categories: allCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      estimatedDays: c.estimatedDays,
    })),
  });
}
