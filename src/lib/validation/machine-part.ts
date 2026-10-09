import { z } from 'zod';
import { isMachineState } from '@/constants/machine-state';
import { isOperationalImpact } from '@/constants/machine-part';
import { MachineState } from '@/types/machine';
import {
  type CreateMachinePartRequest,
  type MachinePart,
  type MachinePartStatus,
  type UpdateMachinePartRequest,
} from '@/types/machine-part';
import { emptyToUndefined, optionalText, requiredText } from './primitives';

export const PART_CODE_MAX_LENGTH = 64;
export const PART_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]*$/;

/**
 * Master data of a part. Its current status and operational impact are absent on purpose:
 * both change only through machine logs about the part, exactly as the API models it.
 */
export const machinePartFormSchema = z.object({
  name: requiredText({ label: 'Part name', max: 120, requiredMessage: 'Enter the part name' }),
  partCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter the part code')
    .max(PART_CODE_MAX_LENGTH, `Part code must be at most ${PART_CODE_MAX_LENGTH} characters`)
    .regex(PART_CODE_PATTERN, 'Use letters, digits, ".", "_", "/" or "-", starting with a letter or digit'),
  description: optionalText({ label: 'Description', max: 2000, multiline: true }),
  isCritical: z.boolean(),
  /** Starting condition; only offered when adding a part. */
  status: z.string(),
  /** Only meaningful when the starting condition is not Active. */
  operationalImpact: z.string(),
});

export type MachinePartFormInput = z.input<typeof machinePartFormSchema>;
export type MachinePartFormValues = z.output<typeof machinePartFormSchema>;
export type MachinePartFormField = keyof MachinePartFormInput;

export const MACHINE_PART_FORM_FIELDS: readonly MachinePartFormField[] = Object.keys(
  machinePartFormSchema.shape,
) as MachinePartFormField[];

export function machinePartToFormInput(part?: MachinePart | null): MachinePartFormInput {
  return {
    name: part?.name ?? '',
    partCode: part?.partCode ?? '',
    description: part?.description ?? '',
    isCritical: part?.isCritical ?? false,
    status: part?.status ?? MachineState.ACTIVE,
    operationalImpact: part?.operationalImpact ?? '',
  };
}

function toPartStatus(value: string): MachinePartStatus {
  if (!isMachineState(value)) throw new Error(`Invalid part status: ${value}`);
  return value;
}

export function toCreateMachinePartRequest(values: MachinePartFormValues): CreateMachinePartRequest {
  const description = emptyToUndefined(values.description);
  const status = toPartStatus(values.status);
  const impact = isOperationalImpact(values.operationalImpact) ? values.operationalImpact : undefined;
  return {
    name: values.name,
    partCode: values.partCode,
    isCritical: values.isCritical,
    status,
    ...(description ? { description } : {}),
    // The API derives the impact from isCritical for a part that starts Active.
    ...(status !== MachineState.ACTIVE && impact ? { operationalImpact: impact } : {}),
  };
}

/** Only changed fields are sent; clearing the description removes it. */
export function toUpdateMachinePartRequest(
  values: MachinePartFormValues,
  part: MachinePart,
): UpdateMachinePartRequest {
  const request: UpdateMachinePartRequest = {};
  if (values.name !== part.name) request.name = values.name;
  if (values.partCode !== part.partCode) request.partCode = values.partCode;
  const description = emptyToUndefined(values.description) ?? null;
  if (description !== part.description) request.description = description;
  if (values.isCritical !== part.isCritical) request.isCritical = values.isCritical;
  return request;
}
