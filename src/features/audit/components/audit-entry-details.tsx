'use client';

import Link from 'next/link';
import { DetailList } from '@/components/data/detail-list';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
import { AUDIT_ACTION_CONFIG, AUDIT_ENTITY_LABELS, getAuditEntityHref } from '@/constants/audit';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import { type AuditLog } from '@/types/audit';
import { computeAuditChanges, formatAuditValue, humanizeField } from '../lib/changes';

function Value({ value }: { value: unknown }) {
  const text = formatAuditValue(value);
  return typeof value === 'object' && value !== null ? (
    <pre className="max-w-full overflow-x-auto font-mono text-[11px] whitespace-pre-wrap break-all">{text}</pre>
  ) : (
    <span className={cn('break-words', text === '—' && 'text-muted')}>{text}</span>
  );
}

export function AuditEntryDetails({ entry, onClose }: { entry: AuditLog | null; onClose(): void }) {
  const changes = entry ? computeAuditChanges(entry.oldValues, entry.newValues) : [];
  const href = entry ? getAuditEntityHref(entry.entity, entry.entityId) : null;

  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={entry ? AUDIT_ACTION_CONFIG[entry.action].label : 'Audit entry'}
      description={entry ? formatDateTime(entry.createdAt) : undefined}
      className="w-[min(100vw,32rem)]"
    >
      {entry ? (
        <div className="flex flex-col gap-6 px-5 py-4">
          <DetailList
            columns={1}
            items={[
              { label: 'Action', value: <Badge tone={AUDIT_ACTION_CONFIG[entry.action].tone}>{AUDIT_ACTION_CONFIG[entry.action].label}</Badge> },
              { label: 'User', value: entry.user ? `${entry.user.fullName} (${entry.user.email})` : 'System or unknown user' },
              {
                label: 'Record',
                value: (
                  <span>
                    {AUDIT_ENTITY_LABELS[entry.entity]}
                    {entry.entityId ? (
                      href ? (
                        <Link href={href} className="ml-1 font-mono hover:underline">
                          #{entry.entityId}
                        </Link>
                      ) : (
                        <span className="ml-1 font-mono">#{entry.entityId}</span>
                      )
                    ) : null}
                  </span>
                ),
              },
              { label: 'IP address', value: <span className="font-mono">{entry.ipAddress ?? '—'}</span> },
              { label: 'Device', value: entry.userAgent ?? '—' },
              { label: 'Request ID', value: <span className="font-mono text-xs">{entry.requestId ?? '—'}</span> },
            ]}
          />

          <section aria-labelledby="audit-changes">
            <h3 id="audit-changes" className="mb-2 text-sm font-semibold text-ink">
              Changes
            </h3>
            {changes.length === 0 ? (
              <p className="text-[13px] text-muted">No field values were recorded for this action.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-sunken text-[11px] tracking-wide text-muted uppercase">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Field
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Before
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        After
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {changes.map((change) => (
                      <tr key={change.field} className={cn(change.changed && 'bg-warning-soft/40')}>
                        <th scope="row" className="px-3 py-2 align-top font-medium whitespace-nowrap text-ink-secondary">
                          {humanizeField(change.field)}
                        </th>
                        <td className="px-3 py-2 align-top">
                          <Value value={change.before} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Value value={change.after} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted">Sensitive values such as passwords and tokens are never recorded.</p>
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}
