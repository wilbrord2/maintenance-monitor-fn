import { type FieldPath, type FieldValues, type UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/lib/api/errors';

/**
 * Copies API validation details onto matching form fields.
 * API field names may be prefixed with `body.`; `fieldMap` renames fields that differ.
 * Returns true when at least one field error was applied.
 */
export function applyServerFieldErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  fields: readonly FieldPath<TValues>[],
  fieldMap: Readonly<Record<string, FieldPath<TValues>>> = {},
): boolean {
  if (!isApiError(error) || error.details.length === 0) return false;
  const known = new Set<string>(fields);
  let applied = false;
  for (const detail of error.details) {
    const apiField = detail.field.replace(/^body\./, '');
    const target = fieldMap[apiField] ?? (known.has(apiField) ? (apiField as FieldPath<TValues>) : null);
    if (!target) continue;
    setError(target, { type: 'server', message: capitalize(detail.message) }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}

function capitalize(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}
