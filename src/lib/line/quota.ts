import { getLineMessageQuota, type LineMessageQuota } from './client';

export const LINE_QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;

interface QuotaCacheEntry {
  data: LineMessageQuota;
  expiresAt: number;
}

let cachedQuota: QuotaCacheEntry | null = null;

export function clearLineQuotaCache(): void {
  cachedQuota = null;
}

export async function fetchLineQuota(opts?: { forceRefresh?: boolean }): Promise<LineMessageQuota> {
  const now = Date.now();
  if (!opts?.forceRefresh && cachedQuota && cachedQuota.expiresAt > now) {
    return cachedQuota.data;
  }

  try {
    const fresh = await getLineMessageQuota();
    cachedQuota = {
      data: fresh,
      expiresAt: Date.now() + LINE_QUOTA_CACHE_TTL_MS,
    };
    return fresh;
  } catch (err) {
    // § ล้างแคชเก่าเมื่อดึงใหม่ล้มเหลว — กันแสดงตัวเลขเก่าค้างเมื่อ token เสียหรือ LINE ล่ม
    cachedQuota = null;
    throw err;
  }
}

export function describeLineQuota(quota: LineMessageQuota | null | undefined): string {
  if (!quota) return 'ไม่สามารถดึงข้อมูลโควต้าได้ชั่วคราว';
  if (quota.type === 'none' || quota.limit === null || quota.remaining === null) {
    return `โควต้า LINE: ไม่จำกัด (ใช้ไป ${quota.used.toLocaleString('th-TH')} ข้อความ)`;
  }
  return `โควต้า LINE คงเหลือ ${quota.remaining.toLocaleString('th-TH')} / ${quota.limit.toLocaleString('th-TH')} ข้อความ`;
}
