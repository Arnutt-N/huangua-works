export const INTAKE_DRAFT_KEY = 'huangua:intake-draft:v1';
export const TRACK_DRAFT_KEY = 'huangua:track-draft:v1';

// § รับเฉพาะค่าที่อนุญาต ไม่ serialize ฟอร์มทั้งก้อนหรือข้อความที่อาจมี PII
function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ปิด storage หรือพื้นที่เต็มต้องไม่ทำให้ฟอร์มใช้งานไม่ได้
  }
}

function readDraft(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // ข้อมูลเสียหรือเบราว์เซอร์ไม่ให้เข้าถึง storage ให้กลับไปใช้ฟอร์มว่าง
  }
  clearDraft(key);
  return null;
}

function writeDraft(key: string, value: object): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // การบันทึกดราฟต์เป็นเพียงตัวช่วย ไม่ขัดขวางการส่งหรือค้นหาเรื่อง
  }
}

function hasOnlyField(draft: Record<string, unknown>, field: string): boolean {
  return draft.version === 1 && Object.keys(draft).length === 2 && Object.hasOwn(draft, field);
}

export function clearIntakeDraft(): void {
  clearDraft(INTAKE_DRAFT_KEY);
}

export function saveIntakeDraft(categoryId: string, categoryIds: readonly string[]): void {
  if (!categoryId || !categoryIds.includes(categoryId)) {
    clearIntakeDraft();
    return;
  }
  writeDraft(INTAKE_DRAFT_KEY, { version: 1, categoryId });
}

export function readIntakeDraft(categoryIds: readonly string[]): { categoryId: string } | null {
  const draft = readDraft(INTAKE_DRAFT_KEY);
  if (!draft) return null;
  if (hasOnlyField(draft, 'categoryId') && typeof draft.categoryId === 'string' && categoryIds.includes(draft.categoryId)) {
    return { categoryId: draft.categoryId };
  }
  // § ไม่คืนข้อมูลจากรุ่นอื่นหรือ payload ที่มีชื่อ/CID/โทรศัพท์ปะปน แม้หมวดจะถูกต้อง
  clearIntakeDraft();
  return null;
}

// § รูปแบบตรงกับ case-tracking.ts ซึ่ง import node:crypto จึงนำเข้า client ไม่ได้
const trackingCodePattern = /^(HG|HN)\d{9}$/;

export function clearTrackDraft(): void {
  clearDraft(TRACK_DRAFT_KEY);
}

export function saveTrackDraft(input: string): void {
  const trackId = input.replace(/[\s-]/g, '').toUpperCase();
  if (!trackingCodePattern.test(trackId)) {
    clearTrackDraft();
    return;
  }
  writeDraft(TRACK_DRAFT_KEY, { version: 1, trackId });
}

export function readTrackDraft(): { trackId: string } | null {
  const draft = readDraft(TRACK_DRAFT_KEY);
  if (!draft) return null;
  if (hasOnlyField(draft, 'trackId') && typeof draft.trackId === 'string' && trackingCodePattern.test(draft.trackId)) {
    return { trackId: draft.trackId };
  }
  clearTrackDraft();
  return null;
}
