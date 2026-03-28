import sharp from 'sharp';
import { uploadToR2, deleteFromR2 } from './r2-client';

/**
 * Download an avatar from LINE, compress into WebP 256x256, and upload to R2.
 * Uses a fixed key per user (overwrites previous avatar automatically).
 * Returns the uploaded file key.
 *
 * @param oldR2Key - If provided and differs from the new key, delete the old file
 */
export async function archiveAvatarToR2(
  lineUserId: string,
  pictureUrl: string,
  oldR2Key?: string | null
): Promise<string | null> {
  try {
    if (!pictureUrl) return null;

    // Fetch original image
    const response = await fetch(pictureUrl);
    if (!response.ok) {
      console.warn(`[avatar-archiver] Failed to fetch avatar for ${lineUserId}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to WebP only (no resize) — keeps original dimensions, reduces file size
    const processedBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();

    // Fixed key per user — overwrites in R2 automatically
    const key = `avatars/${lineUserId}.webp`;

    // Upload to R2 (overwrite existing)
    await uploadToR2(key, processedBuffer, 'image/webp');

    // If old key was different (e.g. had timestamp), delete the stale file
    if (oldR2Key && oldR2Key !== key) {
      await deleteFromR2(oldR2Key);
      console.log(`[avatar-archiver] Cleaned up old avatar: ${oldR2Key}`);
    }

    console.log(`[avatar-archiver] Successfully archived avatar for ${lineUserId}`);
    return key;
  } catch (error) {
    console.error(`[avatar-archiver] Error processing avatar for ${lineUserId}:`, error);
    return null;
  }
}
