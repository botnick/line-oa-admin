import { subscriber, CHANNELS } from './redis';

type SSEController = ReadableStreamDefaultController<any>;

// Prevent multiple instances during hot-reload in development
const globalForSSE = globalThis as unknown as {
  sseManager: SSEManager | undefined;
};

class SSEManager {
  private clients = new Set<SSEController>();
  private isSubscribed = false;

  constructor() {
    this.ensureSubscription();
  }

  private async ensureSubscription() {
    if (this.isSubscribed) return;
    
    try {
      await subscriber.subscribe(CHANNELS.SYNC);
      this.isSubscribed = true;
      console.log('[SSEManager] Subscribed to Redis sync channel');

      subscriber.on('message', (channel, message) => {
        if (channel === CHANNELS.SYNC) {
          this.broadcast(message);
        }
      });
    } catch (error) {
      console.error('[SSEManager] Subscription error', error);
      this.isSubscribed = false;
    }
  }

  public addClient(controller: SSEController) {
    this.clients.add(controller);
    this.ensureSubscription(); // Ensure active sub if not already
    console.log(`[SSEManager] Client added, total clients: ${this.clients.size}`);
  }

  public removeClient(controller: SSEController) {
    if (this.clients.delete(controller)) {
      console.log(`[SSEManager] Client removed, total clients: ${this.clients.size}`);
    }
  }

  private broadcast(message: string) {
    if (this.clients.size === 0) return;

    const encoder = new TextEncoder();
    const encoded = encoder.encode(`data: ${message}\n\n`);
    
    for (const client of this.clients) {
      try {
        client.enqueue(encoded);
      } catch (err) {
        // Connection closed or broken
        this.removeClient(client);
      }
    }
  }
}

export const sseManager = globalForSSE.sseManager || new SSEManager();

if (process.env.NODE_ENV !== 'production') {
  globalForSSE.sseManager = sseManager;
}
