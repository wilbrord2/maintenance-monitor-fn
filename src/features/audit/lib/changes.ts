export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

const serialize = (value: unknown) => JSON.stringify(value ?? null);

/** Field-by-field comparison of an audit entry's old and new values (both already sanitised by the API). */
export function computeAuditChanges(
  oldValues: Readonly<Record<string, unknown>> | null,
  newValues: Readonly<Record<string, unknown>> | null,
): AuditChange[] {
  const fields = [...new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])];
  return fields.map((field) => {
    const before = oldValues?.[field];
    const after = newValues?.[field];
    return { field, before, after, changed: serialize(before) !== serialize(after) };
  });
}

/** Text for display. Rendered as text content, never as HTML. */
export function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

/** "resultingState" → "Resulting state". */
export function humanizeField(field: string): string {
  const words = field
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
