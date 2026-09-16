import { z } from 'zod';
import { emailField, passwordInputField, strongPasswordField } from './primitives';

export const loginSchema = z.object({
  email: emailField,
  password: passwordInputField('Enter your password'),
});
export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordFormInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordFormValues = z.output<typeof forgotPasswordSchema>;

/** Shape of the reset token delivered in the email link. */
export const resetTokenSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const resetPasswordSchema = z
  .object({
    newPassword: strongPasswordField,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordFormInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordFormValues = z.output<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: passwordInputField('Enter your current password'),
    newPassword: strongPasswordField,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((values) => values.currentPassword === '' || values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password that is different from your current one',
  });
export type ChangePasswordFormInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordFormValues = z.output<typeof changePasswordSchema>;
