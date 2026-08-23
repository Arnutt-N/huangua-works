/**
 * Verify LINE ID token (LIFF) — ผ่าน verify endpoint ของ LINE เท่านั้น
 *
 * § ห้าม verify signature เองด้วย channel secret — ID token จาก LIFF ถูกเซ็นด้วย
 * HS256 (web flow) หรือ ES256 (LIFF SDK) แล้วแต่ช่องทาง ทำเองกับ secret เดี่ยว ๆ
 * เสี่ยงพังเงียบ ๆ — ให้ LINE เป็นคนตรวจ signature/exp แล้วเราตรวจ aud เอง
 * (ผลลัพธ์: ไม่ต้องเก็บ channel secret ของ LINE Login channel ใน env เลย)
 */

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const VERIFY_TIMEOUT_MS = 10_000;

export interface VerifiedLineIdentity {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
}

export function isLiffMockEnabled(): boolean {
  // § mock เปิดได้จาก env เท่านั้น — ถ้าเป็น query param/flag อื่นจะกลายเป็น
  // ช่องปลอมตัวบน production (ใครก็ส่ง mock token เข้ามาได้)
  return process.env.LIFF_E2E_MOCK === '1';
}

interface LineVerifyResponse {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  name?: string;
  picture?: string;
}

export async function verifyLineIdToken(
  idToken: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<VerifiedLineIdentity> {
  if (isLiffMockEnabled()) {
    // รูปแบบ mock: 'mock.<lineUserId>' — สำหรับ e2e/unit เท่านั้น
    if (idToken.startsWith('mock.') && idToken.length > 'mock.'.length) {
      return { lineUserId: idToken.slice('mock.'.length) };
    }
    throw new Error('mock enabled — token ต้องอยู่ในรูป mock.<lineUserId>');
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId || channelId.startsWith('YOUR_') || channelId.startsWith('CHANGE_ME')) {
    throw new Error('LINE_LOGIN_CHANNEL_ID ยังไม่ได้ตั้งค่า');
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`LINE verify endpoint ตอบ ${res.status}`);
  }

  const data = (await res.json()) as LineVerifyResponse;
  if (data.iss !== 'https://access.line.me' || !data.sub || !data.aud || !data.exp) {
    throw new Error('LINE ID token payload ไม่ถูกต้อง');
  }
  if (data.aud !== channelId) {
    // token ของ channel อื่น (เช่น เอา token จาก LIFF app ที่ไม่ใช่ของระบบมายิง)
    throw new Error('aud ไม่ตรงกับ LINE Login channel ของระบบ');
  }
  if (data.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('LINE ID token หมดอายุ');
  }

  return {
    lineUserId: data.sub,
    displayName: data.name,
    pictureUrl: data.picture,
  };
}
