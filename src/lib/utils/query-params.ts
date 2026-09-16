export type QueryParamValue = string | number | boolean;

/** Drops undefined, null and empty-string values: the API rejects empty or unknown parameters. */
export function compactParams(params: object): Record<string, QueryParamValue> {
  const result: Record<string, QueryParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}
