import sharp from 'sharp';
import { uploadToR2 } from './r2-client';

/**
 * Download an avatar from LINE, compress into WebP 256x256, and upload to R2
 * Returns the uploaded file key
 */
export async function archiveAvatarToR2(
  lineUserId: string,
  pictureUrl: string
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

    // Process with Sharp (WebP, 256x256 cover, q:80)
    const processedBuffer = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Unique filename based on user ID and timestamp to break browser cache
    const timestamp = Date.now();
    const key = `avatars/${lineUserId}-${timestamp}.webp`;

    // Upload to R2
    await uploadToR2(key, processedBuffer, 'image/webp');

    console.log(`[avatar-archiver] Successfully archived avatar for ${lineUserId}`);
    return key;
  } catch (error) {
    console.error(`[avatar-archiver] Error processing avatar for ${lineUserId}:`, error);
    return null;
  }
}
