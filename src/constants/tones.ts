/** Semantic tones. Components pick a tone; this file owns what each tone looks like. */
export type Tone = 'positive' | 'warning' | 'critical' | 'info' | 'neutral';

export interface ToneClasses {
  /** Soft fill, ink text and hairline border, for badges and callouts. */
  badge: string;
  /** Outline-only variant, for secondary statuses that sit next to filled badges. */
  outline: string;
  /** Solid indicator dot or bar. */
  indicator: string;
  /** Ink-coloured text that meets WCAG AA on panel and soft backgrounds. */
  text: string;
  /** Soft background only. */
  surface: string;
  /** Left accent border for tiles and rows. */
  accent: string;
}

export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  positive: {
    badge: 'border-positive-line bg-positive-soft text-positive-ink',
    outline: 'border-positive-line bg-panel text-positive-ink',
    indicator: 'bg-positive',
    text: 'text-positive-ink',
    surface: 'bg-positive-soft',
    accent: 'border-l-positive',
  },
  warning: {
    badge: 'border-warning-line bg-warning-soft text-warning-ink',
    outline: 'border-warning-line bg-panel text-warning-ink',
    indicator: 'bg-warning',
    text: 'text-warning-ink',
    surface: 'bg-warning-soft',
    accent: 'border-l-warning',
  },
  critical: {
    badge: 'border-critical-line bg-critical-soft text-critical-ink',
    outline: 'border-critical-line bg-panel text-critical-ink',
    indicator: 'bg-critical',
    text: 'text-critical-ink',
    surface: 'bg-critical-soft',
    accent: 'border-l-critical',
  },
  info: {
    badge: 'border-info-line bg-info-soft text-info-ink',
    outline: 'border-info-line bg-panel text-info-ink',
    indicator: 'bg-info',
    text: 'text-info-ink',
    surface: 'bg-info-soft',
    accent: 'border-l-info',
  },
  neutral: {
    badge: 'border-neutral-line bg-neutral-soft text-neutral-ink',
    outline: 'border-neutral-line bg-panel text-neutral-ink',
    indicator: 'bg-neutral',
    text: 'text-neutral-ink',
    surface: 'bg-neutral-soft',
    accent: 'border-l-neutral',
  },
};
