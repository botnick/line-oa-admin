import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';

/**
 * SSE endpoint — streams real-time events from Redis Pub/Sub to browser.
 * Uses ReadableStream with heartbeat to keep connection alive.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth check: verify session is valid in DB and JWT
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Import dynamically to avoid top-level require errors in some Edge contexts
      // (Even though forced dynamic runs inside Node for Next pages usually)
      import('@/server/sse-manager').then(({ sseManager }) => {
        sseManager.addClient(controller);

        // Heartbeat every 25s to prevent proxy timeouts
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
            sseManager.removeClient(controller);
          }
        }, 25000);

        // Cleanup on disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          sseManager.removeClient(controller);
          try { controller.close(); } catch { /* already closed */ }
        });
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
