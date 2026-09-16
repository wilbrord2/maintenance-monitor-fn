import { z } from 'zod';
import { type CreateMachineRequest, type Machine, type UpdateMachineRequest } from '@/types/machine';
import { emptyToUndefined, optionalText, requiredText } from './primitives';

export const SERIAL_NUMBER_MAX_LENGTH = 64;
export const SERIAL_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9._/-]*$/;

/** Machine master data. Status is deliberately absent: it changes only through machine logs. */
export const machineFormSchema = z.object({
  name: requiredText({ label: 'Machine name', max: 120, requiredMessage: 'Enter the machine name' }),
  serialNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter the serial number')
    .max(SERIAL_NUMBER_MAX_LENGTH, `Serial number must be at most ${SERIAL_NUMBER_MAX_LENGTH} characters`)
    .regex(SERIAL_NUMBER_PATTERN, 'Use letters, digits, ".", "_", "/" or "-", starting with a letter or digit'),
  description: optionalText({ label: 'Description', max: 2000, multiline: true }),
});

export type MachineFormInput = z.input<typeof machineFormSchema>;
export type MachineFormValues = z.output<typeof machineFormSchema>;

export function machineToFormInput(machine?: Machine | null): MachineFormInput {
  return {
    name: machine?.name ?? '',
    serialNumber: machine?.serialNumber ?? '',
    description: machine?.description ?? '',
  };
}

export function toCreateMachineRequest(values: MachineFormValues): CreateMachineRequest {
  const description = emptyToUndefined(values.description);
  return { name: values.name, serialNumber: values.serialNumber, ...(description ? { description } : {}) };
}

/** Only changed fields are sent; clearing the description removes it. */
export function toUpdateMachineRequest(values: MachineFormValues, machine: Machine): UpdateMachineRequest {
  const request: UpdateMachineRequest = {};
  if (values.name !== machine.name) request.name = values.name;
  if (values.serialNumber !== machine.serialNumber) request.serialNumber = values.serialNumber;
  const description = emptyToUndefined(values.description) ?? null;
  if (description !== machine.description) request.description = description;
  return request;
}
