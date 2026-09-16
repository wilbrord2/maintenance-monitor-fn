import { z } from 'zod';

/**
 * Form-level validation primitives. They mirror the API's rules so problems are reported beside
 * the field before submitting; the API validates again and remains authoritative.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** True when the string contains ASCII control characters (optionally allowing tabs and line breaks). */
export function hasControlCharacters(value: string, allowMultiline: boolean): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x7f) return true;
    if (code >= 0x20) continue;
    if (allowMultiline && (code === 0x09 || code === 0x0a || code === 0x0d)) continue;
    return true;
  }
  return false;
}

interface TextOptions {
  /** Field name in sentence case, e.g. "Machine name". */
  label: string;
  max: number;
  min?: number;
  multiline?: boolean;
  /** Message when empty, e.g. "Enter the machine name". */
  requiredMessage?: string;
}

export function requiredText({ label, max, min = 1, multiline = false, requiredMessage }: TextOptions) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage ?? `${label} is required`)
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine((value) => !hasControlCharacters(value, multiline), `${label} contains characters that aren't allowed`);
}

/** Optional text; an empty string means "not provided". */
export function optionalText({ label, max, multiline = false }: Omit<TextOptions, 'min' | 'requiredMessage'>) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .refine((value) => !hasControlCharacters(value, multiline), `${label} contains characters that aren't allowed`);
}

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter an email address')
  .max(254, 'Email address must be at most 254 characters')
  .regex(z.regexes.email, 'Enter a valid email address, e.g. name@company.com');

export const phoneField = z
  .string()
  .trim()
  .min(1, 'Enter a phone number')
  .regex(/^\+?[0-9]{9,15}$/, 'Use 9–15 digits, optionally starting with +');

export interface PasswordRule {
  id: string;
  label: string;
  test(value: string): boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
  },
  { id: 'lowercase', label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { id: 'uppercase', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'digit', label: 'A number', test: (value) => /[0-9]/.test(value) },
];

export const strongPasswordField = z
  .string()
  .min(1, 'Enter a new password')
  .superRefine((value, ctx) => {
    const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
    if (!failed) return;
    const message =
      failed.id === 'length'
        ? value.length < PASSWORD_MIN_LENGTH
          ? `Use at least ${PASSWORD_MIN_LENGTH} characters`
          : `Use at most ${PASSWORD_MAX_LENGTH} characters`
        : `Include ${failed.label.toLowerCase()}`;
    ctx.addIssue({ code: 'custom', message });
  });

/** A password supplied for verification: only length-bounded. */
export const passwordInputField = (requiredMessage: string) =>
  z.string().min(1, requiredMessage).max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** Empty string → undefined, for optional request fields. */
export function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value;
}
