const LOCALE = 'en-US';

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

/** "1,284" — optional fraction digits are trimmed when zero. */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (maximumFractionDigits === 0) return integerFormat.format(value);
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);
}

/** "12.9K" for large standalone values. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) < 10_000 ? integerFormat.format(value) : compactFormat.format(value);
}

/** Downtime and durations: "0 h", "2.5 h", "1,204 h". */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  return `${formatNumber(hours, Math.abs(hours) < 100 ? 1 : 0)} h`;
}

/** "3 logs", "1 log". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** "Amina Uwase" → "AU". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

/** Share of a total as a whole percentage; 0 when the total is 0. */
export function toPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
