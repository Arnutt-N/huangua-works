import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;

function getS3(): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
    forcePathStyle: true,
  });
  return client;
}

function getBucket(): string {
  return process.env.S3_BUCKET ?? 'media';
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
  timeoutMs = 30000,
): Promise<string> {
  const s3 = getS3();
  // § S3 ค้างต้องจบเป็น skipped ไม่ใช่ดึง webhook ค้าง — caller จับ error เอง
  await s3.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }), { abortSignal: AbortSignal.timeout(timeoutMs) });
  return `${process.env.S3_ENDPOINT}/${getBucket()}/${key}`;
}

/** § inverse ของ uploadFile — URL ใน DB ถูกเก็บเป็น endpoint เติม bucket นำหน้า key
 *  ห้ามใช้ slice(N) เพราะ endpoint ของ Supabase มี path prefix (`/storage/v1/s3`) */
export function keyFromUrl(url: string): string | null {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return null;
  const prefix = `${endpoint}/${getBucket()}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length) || null;
}

export async function deleteFile(key: string): Promise<void> {
  const s3 = getS3();
  await s3.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export interface ReadUrlOptions {
  contentType?: string;
  /** inline สำหรับรูป, attachment สำหรับที่เหลือ — กัน stored-XSS */
  disposition?: 'inline' | 'attachment';
  filename?: string;
  /** default 300 วินาที — SigV4 เพดาน 900 */
  expiresIn?: number;
}

const READ_URL_DEFAULT_TTL = 300;
const READ_URL_MAX_TTL = 900;

/** § route ใช้ค่านี้ตอบ client — ที่เดียว ไม่ให้ hardcode 300 ซ้ำในสอง route */
export const READ_URL_TTL_SECONDS = READ_URL_DEFAULT_TTL;

/** § mime ที่แสดงในเบราว์เซอร์ได้อย่างปลอดภัย — ที่เหลือบังคับดาวน์โหลด (กัน stored-XSS) */
const INLINE_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function dispositionFor(mimeType: string): 'inline' | 'attachment' {
  return INLINE_MIMES.has(mimeType) ? 'inline' : 'attachment';
}

/**
 * § key ของแถว — storage_key ก่อน แล้ว fallback ไป URL เดิมของแถวก่อน backfill
 * ใช้ร่วมกันสอง route เพื่อไม่ให้ fallback เขียนต่างกันคนละแบบ
 */
export function resolveReadKey(row: { storageKey: string | null; legacyUrl: string | null }): string | null {
  return row.storageKey ?? (row.legacyUrl ? keyFromUrl(row.legacyUrl) : null);
}

/**
 * § presigned GET สำหรับอ่านไฟล์ — ต้องเซ็น GetObject ไม่ใช่ PutObject
 * (ของเดิม `getPresignedUrl` เซ็น PutObject และไม่มี caller = dead export ที่ใช้ดาวน์โหลดไม่ได้)
 *
 * § reject key ที่มี `..` หรือขึ้นต้นด้วย `/` — caller ต้อง derive key จาก DB เอง
 * ไม่ใช่รับจาก client แต่กันไว้อีกชั้นเผื่อมีคนส่งค่าผ่านมา
 */
export async function readUrlForKey(key: string, opts: ReadUrlOptions = {}): Promise<string> {
  if (!key || key.startsWith('/') || key.split('/').includes('..')) {
    throw new Error('storage key ไม่ถูกต้อง');
  }
  const expiresIn = Math.min(Math.max(opts.expiresIn ?? READ_URL_DEFAULT_TTL, 1), READ_URL_MAX_TTL);

  const disposition = opts.disposition
    ? opts.disposition === 'inline' && opts.filename
      ? `inline; filename="${encodeURIComponent(opts.filename)}"`
      : opts.disposition
    : undefined;

  const s3 = getS3();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
      ...(disposition ? { ResponseContentDisposition: disposition } : {}),
    }),
    { expiresIn },
  );
}

export function isStorageConfigured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}
