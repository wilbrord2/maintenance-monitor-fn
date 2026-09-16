import { formatDateRange, isIsoDateString } from '@/lib/utils/date';
import { parseDateParam, parseEnumParam } from '@/lib/utils/url-params';
import { type AnalyticsRangeParams } from '@/types/analytics';

export const TIMEFRAME_PRESETS = ['7', '30', '90', 'custom'] as const;
export type TimeframePreset = (typeof TIMEFRAME_PRESETS)[number];

export const DEFAULT_TIMEFRAME: TimeframePreset = '30';
export const MAX_RANGE_DAYS = 366;

export const TIMEFRAME_OPTIONS: ReadonlyArray<{ value: TimeframePreset; label: string }> = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: 'custom', label: 'Custom range' },
];

export interface Timeframe {
  preset: TimeframePreset;
  /** Parameters sent to the analytics API. */
  range: AnalyticsRangeParams;
  from?: string;
  to?: string;
  /** Set when a custom range in the URL is incomplete or invalid; data is not requested. */
  error?: string;
}

const DAY_MS = 86_400_000;

function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** Mirrors the API's rules for calendar ranges. `today` is YYYY-MM-DD. */
export function validateCustomRange(from: string | undefined, to: string | undefined, today: string): string | null {
  if (!from || !to) return 'Choose both a start and an end date';
  if (!isIsoDateString(from) || !isIsoDateString(to)) return 'Enter valid dates';
  if (from > to) return 'The end date must be on or after the start date';
  if (from > today) return "The start date can't be in the future";
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) return `Choose a range of ${MAX_RANGE_DAYS} days or fewer`;
  return null;
}

export function parseTimeframe(params: Pick<URLSearchParams, 'get'>, today: string): Timeframe {
  const preset = parseEnumParam(params.get('range'), TIMEFRAME_PRESETS) ?? DEFAULT_TIMEFRAME;
  if (preset !== 'custom') return { preset, range: { days: Number(preset) } };

  const from = parseDateParam(params.get('from'));
  const to = parseDateParam(params.get('to'));
  const error = validateCustomRange(from, to, today);
  if (error || !from || !to) return { preset, range: { days: Number(DEFAULT_TIMEFRAME) }, from, to, error: error ?? undefined };
  return { preset, range: { from, to }, from, to };
}

export function describeTimeframe(timeframe: Timeframe): string {
  if (timeframe.preset !== 'custom') return `Last ${timeframe.preset} days`;
  if (timeframe.from && timeframe.to && !timeframe.error) return formatDateRange(timeframe.from, timeframe.to);
  return 'Custom range';
}
