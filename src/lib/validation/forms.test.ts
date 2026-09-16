import { describe, expect, it } from 'vitest';
import { makeMachine, makeUser } from '@/test/factories';
import { changePasswordSchema, loginSchema, resetPasswordSchema } from './auth';
import { machineFormSchema, toUpdateMachineRequest } from './machine';
import { technicianFormSchema, toUpdateUserRequest } from './user';

const firstMessage = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }, field: string) =>
  result.error?.issues.find((issue) => issue.path[0] === field)?.message;

describe('authentication forms', () => {
  it('normalises the login email and requires a password', () => {
    expect(loginSchema.parse({ email: '  Jane.Doe@Example.COM ', password: 'x' }).email).toBe('jane.doe@example.com');
    expect(firstMessage(loginSchema.safeParse({ email: 'nope', password: '' }), 'email')).toMatch(/valid email/);
    expect(firstMessage(loginSchema.safeParse({ email: 'a@b.co', password: '' }), 'password')).toBe('Enter your password');
  });

  it('enforces the password policy one rule at a time', () => {
    const check = (newPassword: string) =>
      firstMessage(resetPasswordSchema.safeParse({ newPassword, confirmPassword: newPassword }), 'newPassword');
    expect(check('Short1')).toBe('Use at least 12 characters');
    expect(check('alllowercase123')).toBe('Include an uppercase letter');
    expect(check('NoDigitsInHereAtAll')).toBe('Include a number');
    expect(check('ValidPassword123')).toBeUndefined();
  });

  it('requires matching confirmation and a different new password', () => {
    expect(
      firstMessage(changePasswordSchema.safeParse({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123', confirmPassword: 'Other' }), 'confirmPassword'),
    ).toBe('Passwords do not match');
    expect(
      firstMessage(
        changePasswordSchema.safeParse({ currentPassword: 'SamePassword123', newPassword: 'SamePassword123', confirmPassword: 'SamePassword123' }),
        'newPassword',
      ),
    ).toMatch(/different/);
  });
});

describe('machine form', () => {
  it('upper-cases serial numbers and rejects invalid characters', () => {
    expect(machineFormSchema.parse({ name: 'Laser 1', serialNumber: ' lsr-2024/01 ', description: '' }).serialNumber).toBe('LSR-2024/01');
    expect(firstMessage(machineFormSchema.safeParse({ name: 'Laser', serialNumber: '-bad serial', description: '' }), 'serialNumber')).toMatch(
      /letters, digits/,
    );
  });

  it('sends only changed machine fields and clears the description', () => {
    const machine = makeMachine({ description: 'Bay 3' });
    expect(toUpdateMachineRequest({ name: machine.name, serialNumber: 'PRS-002', description: '' }, machine)).toEqual({
      serialNumber: 'PRS-002',
      description: null,
    });
  });
});

describe('technician form', () => {
  it('validates phone numbers', () => {
    const result = technicianFormSchema.safeParse({ fullName: 'Jo Doe', email: 'jo@example.com', phone: '12-34', position: '' });
    expect(firstMessage(result, 'phone')).toMatch(/9–15 digits/);
  });

  it('diffs user updates', () => {
    const user = makeUser({ position: 'Mechanic' });
    expect(toUpdateUserRequest({ fullName: user.fullName, email: 'new@example.com', phone: user.phone, position: '' }, user)).toEqual({
      email: 'new@example.com',
      position: null,
    });
  });
});
