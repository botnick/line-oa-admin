/**
 * Debug script: tests the full Redis → Socket.IO → browser event chain
 * Run: node test-socket-debug.mjs
 */

import { createServer } from 'node:http';
import { io as Client } from 'socket.io-client';
import Redis from 'ioredis';

const PORT = process.env.PORT || 3333;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('\n=== LINE OA Real-time Debug ===\n');

// 1. Test Redis connection
console.log('1️⃣  Testing Redis connection...');
const redis = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });

try {
  await redis.connect();
  const pong = await redis.ping();
  console.log(`   ✅ Redis OK — PING → ${pong} (${REDIS_URL})`);
} catch (err) {
  console.error(`   ❌ Redis FAILED: ${err.message}`);
  console.error('   💡 Fix: Make sure Redis is running — try: redis-server OR docker run -p 6379:6379 redis:alpine');
  process.exit(1);
}

// 2. Test Socket.IO connection to the running server
console.log(`\n2️⃣  Connecting to Socket.IO at http://localhost:${PORT}/api/socket ...`);
const socket = Client(`http://localhost:${PORT}`, {
  path: '/api/socket',
  transports: ['websocket'],
  timeout: 5000,
});

let connected = false;
socket.on('connect', () => {
  connected = true;
  console.log(`   ✅ Socket.IO connected! socket.id = ${socket.id}`);
});

socket.on('connect_error', (err) => {
  console.error(`   ❌ Socket.IO FAILED: ${err.message}`);
  console.error('   💡 Fix: Make sure the dev server is running with "pnpm run dev" (uses server.ts not next dev)');
  redis.disconnect();
  process.exit(1);
});

// Wait for connect
await new Promise((res, rej) => {
  socket.once('connect', res);
  socket.once('connect_error', rej);
  setTimeout(() => rej(new Error('Socket connect timeout after 5s')), 5000);
}).catch((err) => {
  console.error(`   ❌ ${err.message}`);
  redis.disconnect();
  process.exit(1);
});

// 3. Listen for sync event and publish one
console.log('\n3️⃣  Publishing a test sync event via Redis Pub/Sub...');

let received = false;
socket.on('sync', (data) => {
  received = true;
  console.log(`   ✅ Browser received 'sync' event:`, JSON.stringify(data));
});

const testPayload = JSON.stringify({
  type: 'NEW_MESSAGE',
  timestamp: Date.now(),
  payload: { conversationId: 'test-123', messageId: 'msg-test', contactId: 'contact-test' }
});

await redis.publish('line:oa:sync', testPayload);
console.log(`   📤 Published to Redis channel "line:oa:sync"`);

// Wait 1 second for event to arrive
await new Promise(res => setTimeout(res, 1500));

if (received) {
  console.log('\n✅ Full real-time chain works!\n   Redis → Socket.IO Server → Browser');
} else {
  console.error('\n❌ Browser did NOT receive the event within 1.5s');
  console.error('   Possible issues:');
  console.error('   - Socket.IO server not subscribed to Redis (check initSocketServer())');
  console.error('   - Wrong Redis channel (check CHANNELS.SYNC matches "line:oa:sync")');
  console.error('   - Event emitted before socket subscribed');
}

socket.disconnect();
redis.disconnect();
process.exit(0);
