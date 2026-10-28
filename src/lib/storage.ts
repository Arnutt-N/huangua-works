import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3 = getS3();
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: getBucket(), Key: key }), { expiresIn });
}

export function isStorageConfigured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}
