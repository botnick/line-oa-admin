import dotenv from 'dotenv';
import { resolve, join } from 'path';
import { defineConfig, env } from 'prisma/config';

// Load .env from monorepo root (not packages/db/)
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

/**
 * Prisma 7 configuration file.
 *
 * - `datasource.url`: provides the database URL for CLI commands (migrate, db push, studio).
 * - `schema`: points to the Prisma schema file.
 * - `migrations.path`: where migration files are stored.
 *
 * @see https://www.prisma.io/docs/orm/prisma-schema/overview/prisma-config-file
 */
export default defineConfig({
  schema: resolve(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: resolve(__dirname, 'prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
