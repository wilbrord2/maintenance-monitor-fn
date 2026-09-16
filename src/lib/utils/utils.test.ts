import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDayHeading,
  formatRelativeTime,
  fromDateTimeLocalValue,
  isIsoDateString,
  toDateTimeLocalValue,
} from './date';
import { formatHours, getInitials, pluralize, toPercent } from './format';
import { matchesPath, sanitizeRedirectPath } from './path';
import { compactParams } from './query-params';
import { parseIdParam, parsePageSizeParam, parseSortParam } from './url-params';

describe('date formatting', () => {
  const now = new Date(2026, 8, 15, 14, 30);

  it('uses one fixed, 24-hour format', () => {
    expect(formatDate(new Date(2026, 8, 5, 9, 7))).toBe('5 Sep 2026');
    expect(formatDateTime(new Date(2026, 8, 5, 9, 7))).toBe('5 Sep 2026, 09:07');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });

  it('describes recent times relative to now', () => {
    expect(formatRelativeTime(new Date(2026, 8, 15, 14, 29, 40), now)).toBe('just now');
    expect(formatRelativeTime(new Date(2026, 8, 15, 14, 5), now)).toBe('25 min ago');
    expect(formatRelativeTime(new Date(2026, 8, 15, 9, 0), now)).toBe('5 h ago');
    expect(formatRelativeTime(new Date(2026, 8, 14, 22, 15), now)).toBe('Yesterday, 22:15');
    expect(formatRelativeTime(new Date(2026, 8, 11, 8, 0), now)).toBe('4 days ago');
    expect(formatRelativeTime(new Date(2026, 7, 1, 8, 0), now)).toBe('1 Aug 2026');
  });

  it('labels timeline days', () => {
    expect(formatDayHeading(new Date(2026, 8, 15, 1, 0), now)).toBe('Today');
    expect(formatDayHeading(new Date(2026, 8, 14, 23, 0), now)).toBe('Yesterday');
    expect(formatDayHeading(new Date(2026, 8, 13, 10, 0), now)).toBe('Sun, 13 Sep 2026');
  });

  it('round-trips datetime-local values through ISO strings', () => {
    const iso = '2026-09-15T07:45:00.000Z';
    expect(fromDateTimeLocalValue(toDateTimeLocalValue(iso))).toBe(iso);
    expect(fromDateTimeLocalValue('15/09/2026')).toBeNull();
  });

  it('validates calendar dates and formats ranges', () => {
    expect(isIsoDateString('2026-02-28')).toBe(true);
    expect(isIsoDateString('2026-02-30')).toBe(false);
    expect(formatDateRange('2026-09-01', '2026-09-15')).toBe('1 Sep – 15 Sep 2026');
  });
});

describe('number formatting', () => {
  it('formats hours, counts and initials', () => {
    expect(formatHours(2.5)).toBe('2.5 h');
    expect(formatHours(1204.4)).toBe('1,204 h');
    expect(pluralize(1, 'log')).toBe('1 log');
    expect(pluralize(3, 'machine')).toBe('3 machines');
    expect(getInitials('Amina  Uwase Kayitesi')).toBe('AK');
    expect(toPercent(1, 3)).toBe(33);
    expect(toPercent(5, 0)).toBe(0);
  });
});

describe('paths and URL parameters', () => {
  it('matches whole path segments', () => {
    expect(matchesPath('/dashboard/logs/12/edit', '/dashboard/logs/:id/edit', { exact: true })).toBe(true);
    expect(matchesPath('/dashboard/logs-old', '/dashboard/logs')).toBe(false);
  });

  it('only allows same-application redirects', () => {
    expect(sanitizeRedirectPath('/dashboard/machines?status=DOWNTIME', '/dashboard')).toBe('/dashboard/machines?status=DOWNTIME');
    expect(sanitizeRedirectPath('//evil.example', '/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('https://evil.example', '/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/\\evil.example', '/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath(null, '/dashboard')).toBe('/dashboard');
  });

  it('parses tampered parameters safely', () => {
    expect(parseIdParam('12')).toBe(12);
    expect(parseIdParam('12abc')).toBeUndefined();
    expect(parseIdParam('0')).toBeUndefined();
    expect(parsePageSizeParam('500', [10, 20], 20)).toBe(20);
    expect(parseSortParam('name:asc', ['name', 'status'] as const, { sortBy: 'status', sortOrder: 'desc' })).toEqual({ sortBy: 'name', sortOrder: 'asc' });
    expect(parseSortParam('password:asc', ['name'] as const, { sortBy: 'name', sortOrder: 'asc' })).toEqual({ sortBy: 'name', sortOrder: 'asc' });
  });

  it('drops empty query values', () => {
    expect(compactParams({ a: '', b: undefined, c: null, d: 0, e: false, f: 'x' })).toEqual({ d: 0, e: false, f: 'x' });
  });
});
