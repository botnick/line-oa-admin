import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@line-oa/db';
import { verifySignature } from '@/server/line/signature';
import { processEvents } from '@/server/line/event-processor';
import { rateLimit } from '@/server/ratelimit';

/**
 * LINE Webhook handler.
 *
 * POST /api/webhook/line
 *
 * 1. Verify x-line-signature
 * 2. Parse events
 * 3. Process asynchronously (don't block 200 response)
 * 4. Return 200 immediately
 */
export async function POST(request: NextRequest) {
  try {
    // Basic rate limit: 500 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit(`webhook:${ip}`, 500, 60);
    if (!rl.success) {
      console.warn(`[webhook] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Read raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    if (!signature) {
      console.warn('[webhook] Missing x-line-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Parse payload to get the destination (botUserId)
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const destination = payload.destination;
    if (!destination) {
      console.warn('[webhook] Missing destination in payload');
      return NextResponse.json({ error: 'Missing destination' }, { status: 400 });
    }

    // Lookup LineAccount by botUserId
    const lineAccount = await prisma.lineAccount.findUnique({
      where: { botUserId: destination },
    });

    if (!lineAccount || !lineAccount.isActive) {
      console.warn(`[webhook] Unknown or inactive destination: ${destination}`);
      return NextResponse.json({ error: 'Unknown destination' }, { status: 404 });
    }

    // Verify HMAC signature
    if (!verifySignature(lineAccount.channelSecret, body, signature)) {
      console.warn('[webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Mark webhook as verified if not already
    if (!lineAccount.webhookVerified) {
      await prisma.lineAccount.update({
        where: { id: lineAccount.id },
        data: { webhookVerified: true, lastWebhookAt: new Date() },
      });
    }

    const events = payload.events ?? [];
    console.log(`[webhook] Received ${events.length} event(s) for ${lineAccount.displayName || destination}`);

    // Process events asynchronously
    processEvents(events, lineAccount.id, lineAccount.channelAccessToken).catch((err) => {
      console.error('[webhook] Background processing error:', err);
    });

    // LINE requires 200 response within 1 second
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[webhook] Handler error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
