import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

/**
 * JSON-based app settings for Setup Wizard config.
 *
 * Stores LINE API, LINE Login, R2 credentials in a local JSON file.
 * Benefits over DB:
 *  - No query overhead (read from disk, cached in memory)
 *  - Hot-reload: changes apply immediately without restart
 *  - Setup Wizard writes here instead of AppSetting table
 */

/** Settings file path — data/ directory at project root */
const SETTINGS_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

export interface AppSettings {
  app: {
    baseUrl: string;
    appName: string;
  };
  setup: {
    completed: boolean;
    completedAt: string | null;
  };
  lineLogin: {
    channelId: string;
    channelSecret: string;
  };
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    endpoint: string;
    publicUrl: string;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  app: {
    baseUrl: '',
    appName: 'LINE OA Admin',
  },
  setup: {
    completed: false,
    completedAt: null,
  },
  lineLogin: {
    channelId: '',
    channelSecret: '',
  },
  r2: {
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: 'line-oa-media',
    endpoint: '',
    publicUrl: '',
  },
};

/** In-memory cache + file mtime for hot-reload */
let _cache: AppSettings | null = null;
let _lastMtime: number = 0;

/**
 * Read settings from JSON file.
 * Uses in-memory cache with mtime check for hot-reload.
 */
export function getSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return structuredClone(DEFAULT_SETTINGS);
    }

    const stat = fs.statSync(SETTINGS_FILE);
    const mtime = stat.mtimeMs;

    // Return cache if file hasn't changed
    if (_cache && mtime === _lastMtime) {
      return _cache;
    }

    // Re-read file
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const data = JSON.parse(raw);

    // Merge with defaults (handles missing keys gracefully)
    _cache = {
      app: { ...DEFAULT_SETTINGS.app, ...data.app },
      setup: { ...DEFAULT_SETTINGS.setup, ...data.setup },
      lineLogin: { ...DEFAULT_SETTINGS.lineLogin, ...data.lineLogin },
      r2: { ...DEFAULT_SETTINGS.r2, ...data.r2 },
    };
    _lastMtime = mtime;

    return _cache;
  } catch (error) {
    console.error('[settings] Failed to read settings.json:', error);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/**
 * Write settings to JSON file (atomic write).
 * Creates data/ directory if needed.
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(SETTINGS_DIR)) {
      fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }

    // Merge with existing settings
    const current = getSettings();
    const merged: AppSettings = {
      app: { ...current.app, ...settings.app },
      setup: { ...current.setup, ...settings.setup },
      lineLogin: { ...current.lineLogin, ...settings.lineLogin },
      r2: { ...current.r2, ...settings.r2 },
    };

    // Atomic write: write to temp file then rename
    const tmpFile = SETTINGS_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(merged, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SETTINGS_FILE);

    // Update cache immediately
    _cache = merged;
    _lastMtime = fs.statSync(SETTINGS_FILE).mtimeMs;
  } catch (error) {
    console.error('[settings] Failed to save settings.json:', error);
    throw new Error('Failed to save settings');
  }
}

/**
 * Check if initial setup is completed.
 */
export function isSetupCompleted(): boolean {
  return getSettings().setup.completed;
}



/**
 * Check if R2 storage is configured.
 */
export function isStorageConfigured(): boolean {
  const s = getSettings();
  return !!(s.r2.accountId && s.r2.accessKeyId && s.r2.secretAccessKey);
}

/**
 * Auto-detect app base URL from request headers.
 * Works with localhost, ngrok, any reverse proxy — zero config.
 *
 * @param req - Incoming request (NextRequest or headers)
 */
export function getAppBaseUrl(req?: { headers: { get(name: string): string | null } }): string {
  const customUrl = getSettings().app?.baseUrl;
  if (customUrl) {
    return customUrl.trim().replace(/\/$/, '');
  }

  if (req) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'http';
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (host) {
      return `${proto}://${host}`;
    }
  }

  // Fallback for non-request contexts (e.g., background jobs)
  const port = process.env.PORT ?? '3333';
  return `http://localhost:${port}`;
}

/**
 * Derive LINE Login callback URL from request.
 * Always follows the actual host — works with ngrok automatically.
 */
export function getLineCallbackUrl(req?: { headers: { get(name: string): string | null } }): string {
  const base = getAppBaseUrl(req).replace(/\/$/, '');
  return `${base}/api/auth/line/callback`;
}

export { dayjs };
