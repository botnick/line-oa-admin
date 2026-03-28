/**
 * Custom HTTP Server — Next.js + Socket.IO
 *
 * Next.js App Router ไม่รองรับ WebSocket ในตัว
 * ไฟล์นี้สร้าง http.Server ที่รัน Next.js request handler
 * และแนบ Socket.IO server ไว้บน port เดียวกัน
 *
 * @see https://socket.io/docs/v4/server-initialization/#with-nextjs
 */
import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initSocketServer } from './src/server/socket-server.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3333', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new SocketIOServer(httpServer, {
    // Path ที่ client จะ connect — ไม่ชนกับ Next.js API routes
    path: '/api/socket',

    // ── Security: CORS ──
    // Dev: อนุญาตทุก origin สำหรับ dev/ngrok
    // Production: อนุญาตเฉพาะ domain จริงเท่านั้น
    cors: {
      origin: dev
        ? true
        : (process.env.NEXT_PUBLIC_APP_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
      credentials: true,
    },

    // ── Transport: WebSocket first, polling fallback ──
    // WebSocket เป็น transport หลัก (เร็ว, ไม่หน่วง)
    // Polling เป็น fallback สำหรับ proxy/firewall ที่บล็อก WS
    transports: ['websocket', 'polling'],

    // ── Heartbeat: ป้องกัน zombie connections ──
    // Mobile browsers จะตัด TCP เมื่อ idle — ping/pong ช่วยรักษา connection
    pingInterval: 25_000,  // ส่ง ping ทุก 25 วินาที
    pingTimeout: 20_000,   // ถ้าไม่ได้ pong ใน 20 วิ → ตัด

    // ── Performance: จำกัดขนาด payload ──
    // 1MB = Socket.IO default — เพียงพอเพราะ sync event เป็น JSON ขนาดเล็ก (~200 bytes)
    maxHttpBufferSize: 1e6,

    // ── Security: ป้องกัน connection flooding ──
    // 45s = Socket.IO default — รองรับ mobile network ที่ latency สูง (3G/4G ไทย/Asia)
    connectTimeout: 45_000,
  });

  // เชื่อม Redis Pub/Sub → Socket.IO broadcast
  initSocketServer(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO path: /api/socket`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
  });
});
