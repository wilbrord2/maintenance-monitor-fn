import { describe, expect, it } from 'vitest';
import { makePart } from '@/test/factories';
import { MachineState } from '@/types/machine';
import { OperationalImpact } from '@/types/machine-part';
import { machinePartFormSchema, toCreateMachinePartRequest, toUpdateMachinePartRequest } from './machine-part';

describe('part master data', () => {
  it('normalises the part code and keeps status out of an update', () => {
    const parsed = machinePartFormSchema.parse({
      name: '  Hydraulic pump ',
      partCode: ' pmp-01 ',
      description: '',
      isCritical: true,
      status: MachineState.ACTIVE,
      operationalImpact: '',
    });
    expect(parsed.partCode).toBe('PMP-01');

    const request = toUpdateMachinePartRequest(parsed, makePart({ name: 'Hydraulic pump', partCode: 'PMP-01' }));
    expect(request).toEqual({ isCritical: true });
    expect(request).not.toHaveProperty('status');
    expect(request).not.toHaveProperty('operationalImpact');
  });

  it('sends an impact only when the part does not start active', () => {
    const base = {
      name: 'Pump',
      partCode: 'PMP-01',
      description: '',
      isCritical: false,
      operationalImpact: OperationalImpact.BLOCKING,
    };
    const active = toCreateMachinePartRequest(machinePartFormSchema.parse({ ...base, status: MachineState.ACTIVE }));
    expect(active.operationalImpact).toBeUndefined();

    const faulty = toCreateMachinePartRequest(machinePartFormSchema.parse({ ...base, status: MachineState.DOWNTIME }));
    expect(faulty.operationalImpact).toBe(OperationalImpact.BLOCKING);
  });
});
