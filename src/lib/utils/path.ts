/**
 * Segment-based path matching. Comparing whole segments (instead of string prefixes) means
 * `/dashboard/logs` never matches `/dashboard/logs-archive`, and `:param` segments match any value.
 */

export function splitPath(pathname: string): string[] {
  return pathname.split(/[?#]/)[0]!.split('/').filter(Boolean);
}

/** True when `pathname` equals `pattern` or (unless `exact`) is nested beneath it. */
export function matchesPath(pathname: string, pattern: string, options: { exact?: boolean } = {}): boolean {
  const pathSegments = splitPath(pathname);
  const patternSegments = splitPath(pattern);
  if (pathSegments.length < patternSegments.length) return false;
  if (options.exact && pathSegments.length !== patternSegments.length) return false;
  return patternSegments.every(
    (segment, index) => segment.startsWith(':') || segment === pathSegments[index],
  );
}

/** Number of literal (non-parameter) segments; used to pick the most specific match. */
export function pathSpecificity(pattern: string): number {
  const segments = splitPath(pattern);
  return segments.length * 2 - segments.filter((segment) => segment.startsWith(':')).length;
}

/**
 * Accepts only same-application relative paths, preventing open redirects through `?next=`.
 */
export function sanitizeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  try {
    const url = new URL(value, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
