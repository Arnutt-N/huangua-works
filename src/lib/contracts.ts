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

// ── rich menu display mode ──────────────────────────────────────────────────
export const RICH_MENU_DISPLAY_MODES = ['ALWAYS', 'SCHEDULED', 'MANUAL'] as const;
export type RichMenuDisplayMode = (typeof RICH_MENU_DISPLAY_MODES)[number];

export function toRichMenuDisplayMode(value: unknown): RichMenuDisplayMode {
  return (RICH_MENU_DISPLAY_MODES as readonly string[]).includes(value as string)
    ? (value as RichMenuDisplayMode)
    : 'ALWAYS';
}

// ── rich menu alias ─────────────────────────────────────────────────────────
const ALIAS_ID_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

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
    const protocol = new URL(uri.trim()).protocol;
    return (ALLOWED_ACTION_URI_SCHEMES as readonly string[]).includes(protocol);
  } catch {
    return false;
  }
}

/** § LINE imagemap ใช้ `linkUri` ไม่ใช่ `uri` — ต้องตรวจทั้งสองชื่อ */
const ACTION_URI_FIELDS = ['uri', 'linkUri'] as const;

export function isValidRichMenuUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('https://')) return false;
  // § <LIFF_ID> หรืออักขระ < > / ช่องว่าง ทำให้ URI parser ของ LINE API (java.net.URI) ตีตก 400
  if (/[<>\s]/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/** rich menu action ต้องเป็น https ที่สมบูรณ์และไม่มี placeholder เช่น <LIFF_ID> */
export function findInvalidRichMenuArea(areas: unknown): string | null {
  if (!Array.isArray(areas)) return null;
  for (const area of areas) {
    const action = (area as { action?: unknown } | null)?.action as
      | { type?: unknown; uri?: unknown }
      | undefined;
    if (!action) continue;
    if (action.type !== 'uri') continue;
    if (typeof action.uri !== 'string' || action.uri.trim() === '') return '(ค่าว่าง)';
    const uri = action.uri.trim();
    if (!isValidRichMenuUri(uri)) return uri;
  }
  return null;
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
    if (value.type === 'uri') {
      for (const field of ACTION_URI_FIELDS) {
        const candidate = value[field];
        if (typeof candidate === 'string' && candidate.trim() !== '' && !isAllowedActionUri(candidate)) {
          return candidate;
        }
      }
    }
    for (const nested of Object.values(value)) {
      const bad = findActionUriViolation(nested);
      if (bad !== null) return bad;
    }
  }
  return null;
}
