import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSettings } from '@line-oa/config/settings';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let __r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (__r2Client) return __r2Client;
  
  const settings = getSettings();
  const { accountId, accessKeyId, secretAccessKey, endpoint } = settings.r2;

  // Derive endpoint if not provided
  const r2Endpoint = endpoint || `https://${accountId}.r2.cloudflarestorage.com`;

  __r2Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return __r2Client;
}

/**
 * Upload a buffer to R2
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const settings = getSettings();

  // Ensure text-based files include charset=utf-8
  // so browsers correctly render Thai/Unicode characters
  const resolvedContentType =
    contentType.startsWith('text/') && !contentType.includes('charset')
      ? `${contentType}; charset=utf-8`
      : contentType;
  
  await client.send(
    new PutObjectCommand({
      Bucket: settings.r2.bucketName,
      Key: key,
      Body: body,
      ContentType: resolvedContentType,
    })
  );

  return key;
}

/**
 * Delete an object from R2 (best-effort, logs errors silently)
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const client = getR2Client();
    const settings = getSettings();
    await client.send(
      new DeleteObjectCommand({
        Bucket: settings.r2.bucketName,
        Key: key,
      })
    );
  } catch (err) {
    console.warn(`[r2-client] Failed to delete key ${key}:`, err);
  }
}

/**
 * Get public URL for an R2 key (using custom domain if configured)
 */
export function getPublicR2Url(key: string): string | null {
  if (!key) return null;
  const settings = getSettings();
  if (settings.r2.publicUrl) {
    const base = settings.r2.publicUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  return null;
}

/**
 * Generate a short-lived presigned URL if no public custom domain is available
 */
export async function getPresignedR2Url(key: string, expiresIn = 3600): Promise<string> {
  const client = getR2Client();
  const settings = getSettings();

  const command = new GetObjectCommand({
    Bucket: settings.r2.bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}
