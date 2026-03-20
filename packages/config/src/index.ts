import { z } from 'zod';

/**
 * Environment configuration schema.
 *
 * Only infrastructure vars live here (DB, Redis, Auth, App).
 * LINE / R2 credentials are managed via Setup Wizard → data/settings.json
 */
const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().url(),

  // Redis (required)
  REDIS_URL: z.string().url(),

  // Auth (required)
  SESSION_SECRET: z.string().min(32),

  // App
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws on invalid config — fail fast at boot.
 */
function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const missing = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => {
        const errors = (val as { _errors?: string[] })?._errors ?? [];
        return `  ${key}: ${errors.join(', ')}`;
      })
      .join('\n');

    throw new Error(
      `❌ Invalid environment configuration:\n${missing}\n\nCheck .env.example for required variables.`
    );
  }

  return result.data;
}

/** Lazy-loaded singleton config instance */
let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = parseEnv();
  }
  return _config;
}

/**
 * Get a partial config for client-side contexts.
 */
export function getPublicConfig() {
  const port = process.env.PORT ?? '3333';
  return {
    port: Number(port),
  };
}

/**
 * Validate config at startup without caching.
 * Useful for health checks.
 */
export function validateConfig(): { valid: boolean; errors?: string[] } {
  const result = envSchema.safeParse(process.env);
  if (result.success) {
    return { valid: true };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  );
  return { valid: false, errors };
}
