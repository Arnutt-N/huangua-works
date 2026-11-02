/**
 * § resolution-photos.ts — โครงสร้างและฟังก์ชันจัดการภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (Before & After)
 *
 * ฟังก์ชันในโมดูลนี้เป็น pure function ปราศจาก side-effect ปลอดภัยต่อการใช้ทั้งฝั่ง Client, Server, และ Tests
 *
 * § ความปลอดภัยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA):
 * - ฟังก์ชัน `sanitizeResolutionPhotosForCitizen` ตัด `uploadedBy` (staff user id) และ S3 `key` ออกทั้งหมด
 *   ก่อนส่งออกไปยังฝั่งประชาชน (/track และ GET /api/cases/[id])
 */

export type ResolutionPhotoTag = 'before' | 'after';

export interface ResolutionPhoto {
  id: string;
  key: string;
  url: string | null;
  tag: ResolutionPhotoTag;
  caption?: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PublicResolutionPhoto {
  id: string;
  url: string;
  tag: ResolutionPhotoTag;
  caption?: string;
  uploadedAt: string;
}

/**
 * แปลงค่า raw metadata จากฐานข้อมูลเป็นรายการ ResolutionPhoto ที่ถูกต้อง
 */
export function parseResolutionPhotos(rawMetadata: unknown): ResolutionPhoto[] {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return [];
  }

  const meta = rawMetadata as Record<string, unknown>;
  const list = meta.resolutionPhotos;
  if (!Array.isArray(list)) {
    return [];
  }

  const photos: ResolutionPhoto[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    const id = typeof obj.id === 'string' ? obj.id : '';
    const key = typeof obj.key === 'string' ? obj.key : '';
    const tag = obj.tag === 'after' ? 'after' : 'before';
    const type = typeof obj.type === 'string' ? obj.type : 'image/jpeg';
    const size = typeof obj.size === 'number' && Number.isFinite(obj.size) ? obj.size : 0;
    const url = typeof obj.url === 'string' ? obj.url : null;
    const caption = typeof obj.caption === 'string' ? obj.caption.trim() : undefined;
    const uploadedAt =
      typeof obj.uploadedAt === 'string' ? obj.uploadedAt : new Date().toISOString();
    const uploadedBy = typeof obj.uploadedBy === 'string' ? obj.uploadedBy : '';

    if (id && key) {
      photos.push({
        id,
        key,
        url,
        tag,
        caption: caption || undefined,
        size,
        type,
        uploadedAt,
        uploadedBy,
      });
    }
  }

  return photos;
}

/**
 * ตัดฟิลด์ข้อมูลภายใน (uploadedBy, S3 key) ออกทั้งหมด เพื่อส่งมอบให้ประชาชนดูได้อย่างปลอดภัย
 */
export function sanitizeResolutionPhotosForCitizen(
  photos: ResolutionPhoto[],
): PublicResolutionPhoto[] {
  return photos
    .filter((p): p is ResolutionPhoto & { url: string } => typeof p.url === 'string' && p.url.length > 0)
    .map((p) => ({
      id: p.id,
      url: p.url,
      tag: p.tag,
      caption: p.caption,
      uploadedAt: p.uploadedAt,
    }));
}

/**
 * เพิ่มภาพถ่ายผลงานใหม่ต่อท้ายรายการเดิม (จำกัดไม่เกิน 20 รูปต่อเคสเพื่อป้องกัน abuse)
 */
export function appendResolutionPhoto(
  currentPhotos: ResolutionPhoto[],
  newPhoto: ResolutionPhoto,
  maxPhotos = 20,
): ResolutionPhoto[] {
  if (currentPhotos.length >= maxPhotos) {
    throw new Error(`ไม่สามารถแนบภาพผลการดำเนินงานเกิน ${maxPhotos} ภาพได้`);
  }
  return [...currentPhotos, newPhoto];
}

/**
 * ลบภาพถ่ายผลงานออกจากรายการตาม photoId
 */
export function removeResolutionPhoto(
  currentPhotos: ResolutionPhoto[],
  photoId: string,
): { updatedPhotos: ResolutionPhoto[]; removedPhoto: ResolutionPhoto | null } {
  const target = currentPhotos.find((p) => p.id === photoId) ?? null;
  const updatedPhotos = currentPhotos.filter((p) => p.id !== photoId);
  return { updatedPhotos, removedPhoto: target };
}

/**
 * รวมรายการภาพถ่ายเข้ากับก้อน metadata เดิม โดยรักษาสมบูรณ์ของฟิลด์อื่น ๆ ใน metadata ทั้งหมด
 */
export function mergeResolutionPhotosIntoMetadata(
  currentMetadata: unknown,
  updatedPhotos: ResolutionPhoto[],
): Record<string, unknown> {
  const meta =
    currentMetadata && typeof currentMetadata === 'object' && !Array.isArray(currentMetadata)
      ? { ...(currentMetadata as Record<string, unknown>) }
      : {};

  meta.resolutionPhotos = updatedPhotos;
  return meta;
}
