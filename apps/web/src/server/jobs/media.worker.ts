import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { prisma } from '@line-oa/db';
import { getContent } from '../line/api';
import { uploadToR2 } from '../r2-client';
import sharp from 'sharp';

interface MediaJobData {
  attachmentId: string;
  lineMessageId: string;
  channelAccessToken: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
}

let __workerStarted = false;

/**
 * Process media attachments:
 * 1. Download binary content from LINE Content API
 * 2. For IMAGES: optimize to single WebP (max 1200px, q80)
 * 3. For others: upload original as-is
 * 4. Update MessageAttachment record with R2 key
 */
async function processMedia(job: Job<MediaJobData>) {
  const { attachmentId, lineMessageId, channelAccessToken, type } = job.data;

  console.log(`[media-worker] Processing ${type} for attachment ${attachmentId}`);

  // 1. Download from LINE
  const buffer = Buffer.from(await getContent(lineMessageId, channelAccessToken));

  let r2Key: string;
  let width: number | null = null;
  let height: number | null = null;
  let uploadedSize = buffer.length;

  if (type === 'IMAGE') {
    // 2a. Single optimized WebP (max 1200px, q80) — saves ~70-80% vs original
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      // Convert to WebP only (no resize) — keeps original dimensions, reduces file size
      const optimized = await sharp(buffer)
        .webp({ quality: 80 })
        .toBuffer();

      r2Key = `media/${attachmentId}.webp`;
      await uploadToR2(r2Key, optimized, 'image/webp');
      uploadedSize = optimized.length;
    } catch (err) {
      console.error(`[media-worker] Sharp failed for ${attachmentId}, uploading raw:`, err);
      r2Key = `media/${attachmentId}`;
      await uploadToR2(r2Key, buffer, 'image/jpeg');
    }
  } else {
    // 2b. VIDEO / AUDIO / FILE — store original as-is
    const ext = getExtForType(type);
    r2Key = `media/${attachmentId}.${ext}`;
    const mimeType = getMimeTypeForType(type);
    await uploadToR2(r2Key, buffer, mimeType);
  }

  // 3. Update DB — single key in r2KeyOriginal, no separate thumb/preview
  await prisma.messageAttachment.update({
    where: { id: attachmentId },
    data: {
      processingStatus: 'COMPLETED',
      r2KeyOriginal: r2Key,
      r2KeyThumbnail: null,
      r2KeyPreview: null,
      originalWidth: width,
      originalHeight: height,
      originalSize: buffer.length,
      optimizedSize: uploadedSize,
    },
  });

  console.log(`[media-worker] ✅ ${type} processed: ${attachmentId} (${r2Key})`);
}

function getMimeTypeForType(type: string): string {
  switch (type) {
    case 'IMAGE': return 'image/webp';
    case 'VIDEO': return 'video/mp4';
    case 'AUDIO': return 'audio/m4a';
    case 'FILE': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

function getExtForType(type: string): string {
  switch (type) {
    case 'VIDEO': return 'mp4';
    case 'AUDIO': return 'm4a';
    default: return 'bin';
  }
}

/**
 * Start the media worker (idempotent — safe to call multiple times).
 */
export function startMediaWorker() {
  if (__workerStarted) return;
  __workerStarted = true;

  const worker = new Worker<MediaJobData>(
    'line-media',
    processMedia,
    {
      connection: redis as any,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[media-worker] Job ${job?.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[media-worker] Job ${job?.id} failed:`, err);
  });

  console.log('[media-worker] 🚀 Media worker started');
}
