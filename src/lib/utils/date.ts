/**
 * Date/time formatting used everywhere in the UI.
 *
 * API timestamps are ISO-8601 in UTC and are always shown in the viewer's local time zone,
 * with a fixed, unambiguous 24-hour format ("15 Sep 2026, 14:05") independent of browser locale.
 * API date filters are calendar days (YYYY-MM-DD).
 */

export type DateInput = string | number | Date;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const EMPTY = '—';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (value: number) => String(value).padStart(2, '0');

export function toDate(input: DateInput | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "15 Sep 2026" */
export function formatDate(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "14:05" */
export function formatTime(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "15 Sep 2026, 14:05" */
export function formatDateTime(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** Machine-readable value for `<time dateTime>`. */
export function toIsoString(input: DateInput | null | undefined): string | undefined {
  return toDate(input)?.toISOString();
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole local calendar days between two dates (positive when `date` is in the past). */
function calendarDaysAgo(date: Date, now: Date): number {
  return Math.round((startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) / DAY);
}

/** "just now", "12 min ago", "3 h ago", "Yesterday, 14:05", "4 days ago", then the full date. */
export function formatRelativeTime(input: DateInput | null | undefined, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  const elapsed = now.getTime() - date.getTime();

  // Small negative values come from clock skew between browser and server.
  if (elapsed < -5 * MINUTE) return formatDateTime(date);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;

  const days = calendarDaysAgo(date, now);
  if (days === 0) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (days === 1) return `Yesterday, ${formatTime(date)}`;
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

/** Group heading for timelines: "Today", "Yesterday" or "Mon, 14 Sep 2026". */
export function formatDayHeading(input: DateInput | null | undefined, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  const days = calendarDaysAgo(date, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${WEEKDAYS[date.getDay()]}, ${formatDate(date)}`;
}

/** Local key (YYYY-MM-DD) used to group items by calendar day. */
export function toLocalDayKey(input: DateInput): string {
  const date = toDate(input);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for `<input type="datetime-local">` in local time: "2026-09-15T14:05". */
export function toDateTimeLocalValue(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return '';
  return `${toLocalDayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts a `datetime-local` value (local time) to an ISO-8601 UTC string. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  return toDate(value)?.toISOString() ?? null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDateString(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** "YYYY-MM-DD" for the local calendar day of `date`. */
export function toIsoDateString(date: Date): string {
  return toLocalDayKey(date);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Hours between two timestamps, or null when either is missing. */
export function hoursBetween(start: DateInput | null | undefined, end: DateInput | null | undefined): number | null {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return null;
  return (endDate.getTime() - startDate.getTime()) / HOUR;
}

/** Formats an inclusive YYYY-MM-DD range: "1 Sep – 15 Sep 2026". */
export function formatDateRange(from: string, to: string): string {
  const start = toDate(`${from}T00:00:00`);
  const end = toDate(`${to}T00:00:00`);
  if (!start || !end) return EMPTY;
  const startLabel =
    start.getFullYear() === end.getFullYear()
      ? `${start.getDate()} ${MONTHS[start.getMonth()]}`
      : formatDate(start);
  return `${startLabel} – ${formatDate(end)}`;
}
