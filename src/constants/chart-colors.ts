/**
 * Chart mark colours. These mirror the CSS tokens in `app/globals.css` (SVG charts need raw values).
 *
 * - Status marks were validated as a set for colour-vision deficiency on the white panel
 *   (worst adjacent CVD ΔE 13.7, normal-vision ΔE 23.6). Amber sits below 3:1 contrast, so every
 *   status chart ships with visible labels and a table view. Status colours are reserved for
 *   machine state and are never used as generic series colours.
 * - Series marks encode identity/magnitude in non-status charts: one series uses `primary`;
 *   an emphasis chart highlights `primary` against the recessive `muted` step.
 */
export const STATUS_MARK_COLORS = {
  positive: '#3f8a55',
  warning: '#e0a030',
  critical: '#b8412f',
  info: '#2f6fa3',
} as const;

export const SERIES_COLORS = {
  primary: '#6b4fbb',
  muted: '#b3b0a5',
} as const;

export const CHART_CHROME = {
  grid: '#eceae3',
  axis: '#c9c5b8',
  tick: '#66645c',
  surface: '#ffffff',
} as const;
