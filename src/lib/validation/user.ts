import { z } from 'zod';
import { type CreateTechnicianRequest, type UpdateProfileRequest, type UpdateUserRequest, type User } from '@/types/user';
import { emailField, emptyToUndefined, optionalText, phoneField, requiredText } from './primitives';

const fullNameField = requiredText({ label: 'Full name', min: 2, max: 120, requiredMessage: 'Enter the full name' });

export const technicianFormSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  phone: phoneField,
  position: optionalText({ label: 'Position', max: 100 }),
});
export type TechnicianFormInput = z.input<typeof technicianFormSchema>;
export type TechnicianFormValues = z.output<typeof technicianFormSchema>;

export const profileFormSchema = z.object({ fullName: fullNameField, phone: phoneField });
export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;

export function userToTechnicianFormInput(user?: User | null): TechnicianFormInput {
  return {
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    position: user?.position ?? '',
  };
}

export function toCreateTechnicianRequest(values: TechnicianFormValues): CreateTechnicianRequest {
  const position = emptyToUndefined(values.position);
  return { fullName: values.fullName, email: values.email, phone: values.phone, ...(position ? { position } : {}) };
}

/** Only changed fields; clearing the position removes it. */
export function toUpdateUserRequest(values: TechnicianFormValues, user: User): UpdateUserRequest {
  const request: UpdateUserRequest = {};
  if (values.fullName !== user.fullName) request.fullName = values.fullName;
  if (values.email !== user.email) request.email = values.email;
  if (values.phone !== user.phone) request.phone = values.phone;
  const position = emptyToUndefined(values.position) ?? null;
  if (position !== user.position) request.position = position;
  return request;
}

export function toUpdateProfileRequest(values: ProfileFormValues, user: User): UpdateProfileRequest {
  const request: UpdateProfileRequest = {};
  if (values.fullName !== user.fullName) request.fullName = values.fullName;
  if (values.phone !== user.phone) request.phone = values.phone;
  return request;
}
