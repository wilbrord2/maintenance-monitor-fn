import {
  type CreateTechnicianRequest,
  type CreateTechnicianResponse,
  type ListUsersParams,
  type UpdateProfileRequest,
  type UpdateUserRequest,
  type User,
} from '@/types/user';
import { deleteData, getData, getPage, patchData, postData, type RequestOptions } from './client';

export const usersApi = {
  getMe: (options?: RequestOptions) => getData<User>('/users/me', undefined, options),

  updateMe: (body: UpdateProfileRequest) => patchData<User>('/users/me', body),

  /** ADMIN only. */
  list: (params: ListUsersParams, options?: RequestOptions) => getPage<User>('/users', params, options),

  /** ADMIN only. */
  get: (id: number, options?: RequestOptions) => getData<User>(`/users/${id}`, undefined, options),

  /** ADMIN only. The API emails a temporary credential and never returns it. */
  createTechnician: (body: CreateTechnicianRequest) => postData<CreateTechnicianResponse>('/users', body),

  update: (id: number, body: UpdateUserRequest) => patchData<User>(`/users/${id}`, body),

  deactivate: (id: number) => postData<User>(`/users/${id}/deactivate`),

  activate: (id: number) => postData<User>(`/users/${id}/activate`),

  reissueTemporaryPassword: (id: number) => postData<User>(`/users/${id}/reissue-temporary-password`),

  remove: (id: number) => deleteData(`/users/${id}`),
};
