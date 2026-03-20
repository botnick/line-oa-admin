import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { uploadToR2, getPublicR2Url, getPresignedR2Url } from '@/server/r2-client';
import { getSession } from '@/server/auth/session';
import { rateLimit } from '@/server/ratelimit';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime',
  'application/pdf',
  'application/zip',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * POST /api/upload — Upload a file to R2.
 * Expects multipart/form-data with a single `file` field.
 * Returns { key, url, mimeType, size }.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    // Max 10 uploads per 60 seconds per IP
    const rl = await rateLimit(`upload:${ip}`, 10, 60);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 10MB.' },
        { status: 413 }
      );
    }

    // Validate mime type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 415 }
      );
    }

    // Generate unique R2 key
    const ext = file.name.split('.').pop() || 'bin';
    const key = `uploads/${randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(key, buffer, file.type);

    // Resolve URL
    const publicUrl = getPublicR2Url(key);
    const url = publicUrl || await getPresignedR2Url(key, 3600);

    return NextResponse.json({
      key,
      url,
      mimeType: file.type,
      size: file.size,
      fileName: file.name,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
