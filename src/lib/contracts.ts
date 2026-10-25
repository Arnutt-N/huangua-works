// § ค่ากับ rule ที่ client และ server ต้องใช้ร่วมกัน — ห้ามประกาศซ้ำในฝั่งไหน
// ไฟล์นี้ต้อง import ได้จากทั้ง client และ server จึงห้ามแตะ zod / db / node API
// (การย้ายไปไว้ในโมดูลฝั่ง server อย่าง rich-menu-service จะลาก postgres เข้า client bundle)

// ── broadcast ───────────────────────────────────────────────────────────────
export const BROADCAST_TEXT_MAX = 5000;
export const BROADCAST_TITLE_MAX = 100;

// ── canned responses ────────────────────────────────────────────────────────
export const CANNED_RESPONSE_CATEGORIES = ['info', 'greeting', 'closing', 'escalation'] as const;
export const CANNED_SHORTCUT_MAX = 30;
export const CANNED_TITLE_MAX = 100;

// § satisfies ทำให้เพิ่ม category ใหม่โดยไม่เติม label แล้ว compile ไม่ผ่าน
export const CANNED_CATEGORY_LABELS: Record<(typeof CANNED_RESPONSE_CATEGORIES)[number], string> = {
  info: 'ข้อมูลทั่วไป',
  greeting: 'ทักทาย',
  closing: 'ปิดการสนทนา',
  escalation: 'ส่งต่อ/ยกระดับ',
};

// ── rich menu alias ─────────────────────────────────────────────────────────
export const ALIAS_ID_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export function isValidAliasId(aliasId: string): boolean {
  return ALIAS_ID_PATTERN.test(aliasId);
}

// ── rich menu image ─────────────────────────────────────────────────────────
export const RICH_MENU_IMAGE_LIMIT_BYTES = 1024 * 1024;

// ── tags ────────────────────────────────────────────────────────────────────
export const TAG_COLORS = ['accent', 'gold', 'success', 'warning', 'danger', 'muted'] as const;

// ── reply object action URI ─────────────────────────────────────────────────
export const ALLOWED_ACTION_URI_SCHEMES = ['https:', 'http:', 'tel:', 'mailto:', 'line:'] as const;

export const URI_SCHEME_ERROR_TH =
  'ลิงก์ไม่ปลอดภัยหรือไม่รองรับ — ใช้ได้เฉพาะ https:, http:, tel:, mailto: หรือ line: เท่านั้น';

export function isAllowedActionUri(uri: string): boolean {
  try {
    const protocol = new URL(uri).protocol;
    return (ALLOWED_ACTION_URI_SCHEMES as readonly string[]).includes(protocol);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function findActionUriViolation(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const bad = findActionUriViolation(item);
      if (bad !== null) return bad;
    }
    return null;
  }
  if (isRecord(value)) {
    if (
      value.type === 'uri' &&
      typeof value.uri === 'string' &&
      value.uri.trim() !== '' &&
      !isAllowedActionUri(value.uri)
    ) {
      return value.uri;
    }
    for (const nested of Object.values(value)) {
      const bad = findActionUriViolation(nested);
      if (bad !== null) return bad;
    }
  }
  return null;
}
