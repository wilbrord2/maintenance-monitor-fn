import { type MachinePartCounts } from '@/types/machine';

/**
 * A short, factual sentence about a machine's parts, built only from the counts the API returns.
 * It describes the parts — it never states or implies the machine's operational status, which the
 * API resolves on its own.
 */
export function describePartsAttention(counts: MachinePartCounts): string {
  if (counts.total === 0) return 'No parts configured';
  if (counts.blocking > 0) {
    return counts.blocking === 1 ? '1 blocking part' : `${counts.blocking} blocking parts`;
  }
  const needingAttention = counts.total - counts.active;
  if (needingAttention > 0) {
    return needingAttention === 1 ? '1 part needs attention' : `${needingAttention} parts need attention`;
  }
  return counts.total === 1 ? '1 part, active' : `All ${counts.total} parts active`;
}

export interface PartBreakdownEntry {
  label: string;
  count: number;
}

/** The non-zero part counts, for a compact breakdown such as "3 active · 1 under maintenance". */
export function partBreakdown(counts: MachinePartCounts): PartBreakdownEntry[] {
  return [
    { label: 'active', count: counts.active },
    { label: 'under maintenance', count: counts.underMaintenance },
    { label: 'downtime', count: counts.downtime },
    { label: 'under test', count: counts.underTest },
  ].filter((entry) => entry.count > 0);
}
