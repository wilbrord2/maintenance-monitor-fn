import { type SortOrder } from '@/types/api';
import { isIsoDateString } from './date';

/** Parsers for URL search parameters. Invalid or tampered values fall back to safe defaults. */

const MAX_ID = 2_147_483_647;

export function parsePageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}

export function parsePageSizeParam(value: string | null, allowed: readonly number[], fallback: number): number {
  const size = Number(value);
  return allowed.includes(size) ? size : fallback;
}

export function parseEnumParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseSearchParam(value: string | null): string {
  return (value ?? '').trim().slice(0, 100);
}

export function parseDateParam(value: string | null): string | undefined {
  return value && isIsoDateString(value) ? value : undefined;
}

export function parseIdParam(value: string | null | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : undefined;
}

export interface SortState<TField extends string> {
  sortBy: TField;
  sortOrder: SortOrder;
}

/** Reads `field:order`, e.g. `updatedAt:desc`. */
export function parseSortParam<TField extends string>(
  value: string | null,
  fields: readonly TField[],
  fallback: SortState<TField>,
): SortState<TField> {
  const [field, order] = (value ?? '').split(':');
  const sortBy = parseEnumParam(field ?? null, fields);
  if (!sortBy || (order !== 'asc' && order !== 'desc')) return fallback;
  return { sortBy, sortOrder: order };
}

export function serializeSort<TField extends string>(sort: SortState<TField>): string {
  return `${sort.sortBy}:${sort.sortOrder}`;
}
