import { Queue, Worker } from 'bullmq';
import { redis } from '../redis';

// Define Queues
export const replyQueue = new Queue('line-reply', { 
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  } 
});

export const mediaQueue = new Queue('line-media', { 
  connection: redis as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  }
});
