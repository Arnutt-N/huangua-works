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
): Promise<string> {
  const s3 = getS3();
  await s3.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${process.env.S3_ENDPOINT}/${getBucket()}/${key}`;
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
