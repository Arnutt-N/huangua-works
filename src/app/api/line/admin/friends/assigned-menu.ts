/**
 * อ่าน/เขียน richMenuId ที่ผูกไว้รายคนใน lineUsers.metadata (jsonb schemaless)
 * รวมไว้ที่เดียว — metadata มีหลาย writer (webhook backfill, assign) ทุกจุดต้อง merge
 * ผ่าน helper นี้เท่านั้น ห้าม spread/destructure เองที่ route (กัน key ใหม่หลุด)
 */
export function getAssignedMenuId(metadata: unknown): string | null {
  const id = (metadata as { richMenuId?: unknown } | null)?.richMenuId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function withAssignedMenuId(metadata: unknown, richMenuId: string): Record<string, unknown> {
  return { ...((metadata as Record<string, unknown> | null) ?? {}), richMenuId };
}

export function withoutAssignedMenuId(metadata: unknown): Record<string, unknown> {
  const next = { ...((metadata as Record<string, unknown> | null) ?? {}) };
  delete next.richMenuId;
  return next;
}
