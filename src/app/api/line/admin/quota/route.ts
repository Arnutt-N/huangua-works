import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { fetchLineQuota } from '@/lib/line/quota';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
    const quota = await fetchLineQuota({ forceRefresh });
    return NextResponse.json(quota);
  } catch (err) {
    console.error('[api/line/admin/quota] failed to fetch LINE quota', err);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลโควต้าจาก LINE ได้ชั่วคราว' },
      { status: 502 },
    );
  }
}
