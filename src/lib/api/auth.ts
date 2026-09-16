import {
  type AuthSession,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type ResetPasswordRequest,
} from '@/types/auth';
import { postData } from './client';

export const authApi = {
  login: (body: LoginRequest) => postData<AuthSession>('/auth/login', body, { skipAuth: true }),

  /** Uses the httpOnly refresh cookie; the refresh token is never read or stored by the client. */
  refresh: () => postData<AuthSession>('/auth/refresh', {}, { skipAuth: true }),

  logout: () => postData<null>('/auth/logout', undefined, { skipSessionHandling: true }),

  changePassword: (body: ChangePasswordRequest) => postData<AuthSession>('/auth/change-password', body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    postData<null>('/auth/forgot-password', body, { skipAuth: true }),

  resetPassword: (body: ResetPasswordRequest) => postData<null>('/auth/reset-password', body, { skipAuth: true }),
};
