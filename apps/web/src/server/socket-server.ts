/**
 * Socket.IO Server — Redis Pub/Sub → Browser Clients
 *
 * Redis Pub/Sub → Socket.IO bridge:
 *   Redis CHANNELS.SYNC → message → io.emit('sync', data)
 *
 * ถูกเรียก 1 ครั้งจาก server.ts ตอนเริ่มรัน
 *
 * NOTE: publishSyncEvent() ใน redis.ts เป็น publisher ฝั่ง server
 * ไฟล์นี้เป็น delivery mechanism — ส่ง event ถึง browser ผ่าน Socket.IO
 */
import type { Server as SocketIOServer } from 'socket.io';
import { subscriber, CHANNELS } from './redis';

let isSubscribed = false;

/**
 * Initialize Socket.IO server and connect to Redis Pub/Sub
 *
 * @param io - Socket.IO server instance from server.ts
 */
export function initSocketServer(io: SocketIOServer): void {
  // ── Connection lifecycle logging ──
  io.on('connection', (socket) => {
    console.log(
      `[Socket.IO] Client connected: ${socket.id} ` +
      `(total: ${io.engine.clientsCount})`
    );

    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket.IO] Client disconnected: ${socket.id} ` +
        `reason: ${reason}`
      );
    });

    // ── Security: ไม่รับ event จาก client ──
    // Server เป็น "push-only" — client ไม่สามารถส่ง event กลับมาได้
    // ป้องกันการ inject ข้อมูลปลอมเข้า system
    socket.onAny((eventName) => {
      console.warn(
        `[Socket.IO] Unexpected client event "${eventName}" from ${socket.id} — ignored`
      );
    });
  });

  // ── Subscribe to Redis Pub/Sub (once) ──
  if (isSubscribed) return;

  subscriber
    .subscribe(CHANNELS.SYNC)
    .then(() => {
      isSubscribed = true;
      console.log('[Socket.IO] Subscribed to Redis sync channel');
    })
    .catch((err) => {
      console.error('[Socket.IO] Redis subscription error:', err);
      isSubscribed = false;
    });

  subscriber.on('message', (channel, message) => {
    if (channel !== CHANNELS.SYNC) return;

    try {
      const data = JSON.parse(message);
      // Broadcast ไปทุก connected client
      io.emit('sync', data);
    } catch (err) {
      console.error('[Socket.IO] Failed to parse Redis message:', err);
    }
  });
}
