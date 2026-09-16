import { type PageParams, type SortParams } from './api';
import { type Role } from './auth';

export interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  position: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTechnicianRequest {
  fullName: string;
  email: string;
  phone: string;
  position?: string;
}

export interface CreateTechnicianResponse {
  user: User;
  onboardingEmailSent: true;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string | null;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string;
}

export const USER_SORT_FIELDS = ['createdAt', 'fullName', 'email', 'lastLoginAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export interface ListUsersParams extends PageParams, SortParams<UserSortField> {
  role?: Role;
  isActive?: boolean;
  search?: string;
}
