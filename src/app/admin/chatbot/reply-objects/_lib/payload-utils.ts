/**
 * ตัวช่วยฟอร์ม Reply Object — parsed payload, internal keys, URI allowlist
 *
 * § payload จริงคือ JSON string ใน state ฟอร์ม; helper พวกนี้แปลงไป/กลับ object
 * ที่ editor กับ live preview ใช้ โดยไม่ throw ตอนผู้ใช้พิมพ์ยังไม่จบ
 */

export const FIELD_CLS =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong';

export const LABEL_CLS = 'text-xs font-semibold uppercase tracking-wide text-muted';

export interface LineAction {
  type: string;
  label?: string;
  text?: string;
  uri?: string;
  data?: string;
  displayText?: string;
}

export interface QuickReplyItem {
  type: 'action';
  action: LineAction;
  imageUrl?: string;
  _key?: string;
}

export interface QuickReply {
  items: QuickReplyItem[];
}

export type Payload = Record<string, unknown>;

/** parse payload string → object; JSON เสีย/ไม่ใช่ object คืน {} เพื่อให้ editor ไม่ crash ตอนพิมพ์ */
export function safeParsePayload(json: string): Payload {
  try {
    const value: unknown = JSON.parse(json);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function makeEmptyAction(type = 'message'): LineAction {
  return { type, label: '' };
}

// --- internal reconciliation keys -------------------------------------------
// § รายการใน editor (quick reply) ถือ `_key` เพื่อให้ React ใช้ key ที่นิ่ง
// key สร้างใน event handler เท่านั้น และถูกถอดออกก่อนบันทึก — payload ที่ส่ง LINE ไม่เปลี่ยนรูป

const INTERNAL_KEY = '_key';

export function newInternalKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withNewKey<T extends object>(item: T): T {
  return { ...item, [INTERNAL_KEY]: newInternalKey() } as T;
}

export function getItemKey(item: unknown, index: number): string {
  if (item !== null && typeof item === 'object') {
    const key = (item as Record<string, unknown>)[INTERNAL_KEY];
    if (typeof key === 'string' && key !== '') return key;
  }
  return `idx-${index}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureKeysOnList(list: unknown): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((item) =>
    isRecord(item) && typeof item[INTERNAL_KEY] !== 'string'
      ? { ...item, [INTERNAL_KEY]: newInternalKey() }
      : item,
  );
}

/** เติม `_key` ให้ quickReply.items — เรียกจาก event handler เท่านั้น (load/type change) */
export function ensureEditorKeys(payload: Payload): Payload {
  const next = { ...payload };
  if (isRecord(next.quickReply)) {
    next.quickReply = { ...next.quickReply, items: ensureKeysOnList(next.quickReply.items) };
  }
  return next;
}

/** ถอด `_key` ออกทั้งก้อนก่อนบันทึก ให้ JSON ตรงรูป LINE เป๊ะ */
export function stripEditorKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripEditorKeys(item)) as unknown as T;
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === INTERNAL_KEY) continue;
      out[k] = stripEditorKeys(v);
    }
    return out as T;
  }
  return value;
}

// --- URI scheme allowlist ---------------------------------------------------

/** scheme ที่ LINE uri action ใช้ได้ — กัน javascript:/data: หลุดไปถึงผู้รับ */
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

/** คืน uri แรกที่ไม่ผ่าน allowlist หรือ null เมื่อผ่านหมด — ครอบทั้ง editor และ raw JSON */
export function findInvalidActionUri(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const bad = findInvalidActionUri(item);
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
      const bad = findInvalidActionUri(nested);
      if (bad !== null) return bad;
    }
  }
  return null;
}

/** skeleton payload ต่อชนิด — ชนิดอื่นเริ่ม {} แล้วแก้ด้วย JSON editor */
export function defaultPayloadForType(objectType: string): Payload {
  if (objectType === 'text_v2') return { text: '' };
  return {};
}
