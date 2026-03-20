import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { PrismaClient } from '../generated/client';

/**
 * Prisma client singleton with Prisma 7 driver adapter.
 *
 * Prisma 7 requires a driver adapter for database communication.
 * We use @prisma/adapter-pg with the 'pg' library for PostgreSQL.
 *
 * In development, reuses the same instance across HMR reloads
 * to prevent exhausting database connections.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // PrismaPg accepts pg.Pool or pg.PoolConfig
  const poolConfig: PoolConfig = { connectionString };
  const adapter = new PrismaPg(poolConfig as any);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export generated types explicitly (avoid `export *` from CJS module for Turbopack)
export { PrismaClient, Prisma } from '../generated/client';

// Re-export enums
export {
  AdminRole,
  ConversationStatus,
  MessageSource,
  MessageType,
  DeliveryStatus,
  AttachmentType,
  ProcessingStatus,
  OutboundStatus,
} from '../generated/client';
