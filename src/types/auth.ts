import { type User } from './user';

export enum Role {
  ADMIN = 'ADMIN',
  TECHNICIAN = 'TECHNICIAN',
}

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Also delivered as an httpOnly cookie; the client never stores this value. */
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthSession {
  user: User;
  mustChangePassword: boolean;
  tokens: TokenPair;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
