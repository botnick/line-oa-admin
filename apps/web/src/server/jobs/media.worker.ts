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
 * 2. Generate thumbnail (for images)
 * 3. Upload original + thumbnail to R2
 * 4. Update MessageAttachment record with R2 keys
 */
async function processMedia(job: Job<MediaJobData>) {
  const { attachmentId, lineMessageId, channelAccessToken, type } = job.data;

  console.log(`[media-worker] Processing ${type} for attachment ${attachmentId}`);

  // 1. Download from LINE
  const buffer = Buffer.from(await getContent(lineMessageId, channelAccessToken));

  const ts = Date.now();
  const basePath = `media/${attachmentId}`;

  // 2. Upload original
  const originalKey = `${basePath}/original`;
  const mimeType = getMimeTypeForType(type);
  await uploadToR2(originalKey, buffer, mimeType);

  let thumbnailKey: string | null = null;
  let previewKey: string | null = null;
  let width: number | null = null;
  let height: number | null = null;

  // 3. Generate thumbnail + preview for images
  if (type === 'IMAGE') {
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      // Thumbnail (120px max)
      const thumbBuffer = await sharp(buffer)
        .resize(120, 120, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer();
      thumbnailKey = `${basePath}/thumb.webp`;
      await uploadToR2(thumbnailKey, thumbBuffer, 'image/webp');

      // Preview (800px max)
      const previewBuffer = await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      previewKey = `${basePath}/preview.webp`;
      await uploadToR2(previewKey, previewBuffer, 'image/webp');
    } catch (err) {
      console.error(`[media-worker] Could not create thumbnails for ${attachmentId}:`, err);
    }
  }

  // 4. For VIDEO: use original as preview (can't generate thumb in this env easily)
  if (type === 'VIDEO') {
    previewKey = originalKey;
  }

  // 5. Update DB
  await prisma.messageAttachment.update({
    where: { id: attachmentId },
    data: {
      processingStatus: 'COMPLETED',
      r2KeyOriginal: originalKey,
      r2KeyThumbnail: thumbnailKey,
      r2KeyPreview: previewKey,
      originalWidth: width,
      originalHeight: height,
      originalSize: buffer.length,
    },
  });

  console.log(`[media-worker] ✅ ${type} processed: ${attachmentId}`);
}

function getMimeTypeForType(type: string): string {
  switch (type) {
    case 'IMAGE': return 'image/jpeg';
    case 'VIDEO': return 'video/mp4';
    case 'AUDIO': return 'audio/m4a';
    case 'FILE': return 'application/octet-stream';
    default: return 'application/octet-stream';
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
