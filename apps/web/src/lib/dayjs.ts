/**
 * Shared dayjs instance with Thai locale and relativeTime plugin.
 * Usage: import { dayjs, formatRelative, formatShortDate, formatTime } from '@/lib/dayjs';
 */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/th';

dayjs.extend(relativeTime);
dayjs.locale('th');

export { dayjs };

/**
 * Format relative time in Thai (e.g., "3 นาทีที่แล้ว").
 */
export function formatRelative(date: Date | string): string {
  return dayjs(date).fromNow();
}

/**
 * Format short date in Thai (e.g., "วันนี้", "เมื่อวาน", "20 มี.ค.").
 */
export function formatShortDate(date: Date | string): string {
  const d = dayjs(date);
  const now = dayjs();
  const diffDays = now.startOf('day').diff(d.startOf('day'), 'day');

  if (diffDays === 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';

  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  if (d.year() === now.year()) {
    return `${dayNames[d.day()]} ${d.format('D MMM')}`;
  }
  // Use Buddhist Era (พ.ศ.)
  return `${d.format('D MMM')} ${d.year() + 543}`;
}

/**
 * Format time only (e.g., "14:30").
 */
export function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm');
}

/**
 * Format date + time (e.g., "วันนี้ 14:30").
 */
export function formatDateTime(date: Date | string): string {
  return `${formatShortDate(date)} ${formatTime(date)}`;
}
