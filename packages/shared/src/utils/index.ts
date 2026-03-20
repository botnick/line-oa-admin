import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';

// Register plugins
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(buddhistEra);
dayjs.locale('th');

/** Default timezone — configurable via setTimezone() */
let currentTimezone = 'Asia/Bangkok';

/**
 * Set the app-wide timezone.
 * Call this at app boot if needed.
 */
export function setTimezone(tz: string): void {
  currentTimezone = tz;
  dayjs.tz.setDefault(tz);
}

/**
 * Get the current app timezone.
 */
export function getTimezone(): string {
  return currentTimezone;
}

/**
 * Create a dayjs instance in the app timezone.
 */
export function toAppTime(date?: Date | string | number): dayjs.Dayjs {
  return dayjs(date).tz(currentTimezone);
}

/**
 * Format a date for Thai display (e.g., "20 มี.ค. 2569").
 */
export function formatThaiDate(date: Date | string): string {
  return toAppTime(date).format('D MMM BBBB');
}

/**
 * Format a date with full format (e.g., "20 มีนาคม 2569").
 */
export function formatThaiDateFull(date: Date | string): string {
  return toAppTime(date).format('D MMMM BBBB');
}

/**
 * Format time in 24hr (e.g., "14:30").
 */
export function formatTime(date: Date | string): string {
  return toAppTime(date).format('HH:mm');
}

/**
 * Format date + time (e.g., "20 มี.ค. 14:30").
 */
export function formatDateTime(date: Date | string): string {
  return toAppTime(date).format('D MMM HH:mm');
}

/**
 * Format relative time in Thai (e.g., "2 นาทีที่แล้ว").
 */
export function formatRelativeTime(date: Date | string): string {
  const d = toAppTime(date);
  const now = dayjs().tz(currentTimezone);
  const diffHours = now.diff(d, 'hour');

  // Use relative for < 24hrs, then date format
  if (diffHours < 24) {
    return d.fromNow();
  }

  // Same year — short date
  if (d.year() === now.year()) {
    return d.format('D MMM');
  }

  // Different year — full date
  return d.format('D MMM BBBB');
}

/**
 * Format for conversation list — smart time display.
 */
export function formatChatTime(date: Date | string): string {
  const d = toAppTime(date);
  const now = dayjs().tz(currentTimezone);

  if (d.isSame(now, 'day')) {
    return d.format('HH:mm');
  }

  if (d.isSame(now.subtract(1, 'day'), 'day')) {
    return 'เมื่อวาน';
  }

  if (d.isSame(now, 'week')) {
    return d.format('ddd');
  }

  if (d.isSame(now, 'year')) {
    return d.format('D MMM');
  }

  return d.format('D/M/BB');
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format duration from milliseconds (e.g., "2:34").
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? '' : '';
}

/** Re-export dayjs for direct use if needed */
export { dayjs };
