import { describe, expect, it } from 'vitest';
import { AuditAction, AuditEntity } from '@/types/audit';
import { getAuditActionConfig, getAuditEntityLabel } from './audit';

describe('audit display config', () => {
  it('labels known actions and entities from the table', () => {
    expect(getAuditActionConfig(AuditAction.MACHINE_SYSTEM_STATUS_CHANGED)).toEqual({ label: 'Machine system status changed', tone: 'info' });
    expect(getAuditEntityLabel(AuditEntity.MACHINE_LOG)).toBe('Machine log');
  });

  it('shows actions and entities it does not know by name instead of failing', () => {
    // e.g. historical entries, or values the API adds after this build.
    expect(getAuditActionConfig('MACHINE_PART_LOG_CREATED')).toEqual({ label: 'Machine part log created', tone: 'neutral' });
    expect(getAuditEntityLabel('MACHINE_PART_LOG')).toBe('Machine part log');
    expect(getAuditActionConfig('toString').label).toBe('Tostring');
  });
});
