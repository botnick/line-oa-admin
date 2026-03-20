import { Worker, Job } from 'bullmq';
import { redis, publishSyncEvent } from '../redis';
import { prisma } from '@line-oa/db';
import { pushMessage, replyMessage } from '../line/api';

// Cache worker instance to prevent duplicates in dev mode
const globalForReplyWorker = globalThis as unknown as {
  replyWorker: Worker | undefined;
};

export const startReplyWorker = () => {
  if (globalForReplyWorker.replyWorker) {
    return globalForReplyWorker.replyWorker;
  }

  const worker = new Worker('line-reply', async (job: Job) => {
    const { outboundRequestId } = job.data;
    
    // Fetch request from DB including lineAccount
    const request = await prisma.outboundRequest.findUnique({
      where: { id: outboundRequestId },
      include: { lineAccount: true }
    });

    if (!request || !request.messageId || !request.lineAccount) return;

    // Mark as sending
    await prisma.outboundRequest.update({
      where: { id: request.id },
      data: { status: 'SENDING', lastAttemptAt: new Date(), attempts: { increment: 1 } }
    });

    try {
      // payload usually stores e.g. { type: 'text', text: 'Hello' }
      const payload = request.payload as Record<string, any>;
      
      // We use pushMessage for replies since we might not have a fresh replyToken
      // (LINE standard tokens expire in 1 min, so pushing is safer for an admin console)
      if (payload.replyToken) {
        await replyMessage(payload.replyToken, [payload], request.lineAccount.channelAccessToken);
      } else {
        await pushMessage(request.lineUserId, [payload], request.lineAccount.channelAccessToken);
      }

      // Mark success
      await prisma.$transaction([
        prisma.outboundRequest.update({
          where: { id: request.id },
          data: { status: 'SENT' }
        }),
        prisma.message.update({
          where: { id: request.messageId! }, // id is non-null because we checked request.message
          data: { deliveryStatus: 'DELIVERED', lineTimestamp: new Date() }
        })
      ]);

      // Broadcast success to UI
      await publishSyncEvent('MESSAGE_UPDATED', { messageId: request.messageId });

    } catch(e: any) {
      console.error('[reply context] Failed to send message', e);
      const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 1);
      
      // Mark failed or retrying
      await prisma.$transaction([
        prisma.outboundRequest.update({
          where: { id: request.id },
          data: { 
            status: isFinalAttempt ? 'FAILED' : 'RETRYING',
            errorMessage: e.message || 'Unknown error'
          }
        }),
        prisma.message.update({
          where: { id: request.messageId! },
          data: { deliveryStatus: isFinalAttempt ? 'FAILED' : 'PENDING' }
        })
      ]);
      
      await publishSyncEvent('MESSAGE_UPDATED', { messageId: request.messageId });
      
      // Re-throw to trigger BullMQ retry
      throw e;
    }
  }, { 
    connection: redis as any,
    concurrency: 5
  });

  worker.on('failed', (job, err) => {
    console.error(`[reply-worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForReplyWorker.replyWorker = worker;
  }

  return worker;
};
