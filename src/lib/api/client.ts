import axios, { type AxiosRequestConfig, isAxiosError } from 'axios';
import { env } from '@/config/env';
import { ErrorCode } from '@/constants/error-codes';
import {
  type ApiPaginatedEnvelope,
  type ApiSuccessEnvelope,
  type MutationResult,
  type PaginatedResponse,
} from '@/types/api';
import { compactParams } from '@/lib/utils/query-params';
import { type ApiError, toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Send without an access token (public endpoints such as login and refresh). */
    skipAuth?: boolean;
    /** Do not end the session on 401 (e.g. logout, where the session is ending anyway). */
    skipSessionHandling?: boolean;
    /** Internal: the request has already been retried after refreshing the session. */
    retriedAfterRefresh?: boolean;
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

/** Session hooks supplied by the auth layer, keeping this module free of UI and store imports. */
export interface AuthHandlers {
  /** A valid access token, refreshed first when it is about to expire; null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Refreshes the session and returns the new access token, or null when it cannot be renewed. */
  refreshAccessToken(): Promise<string | null>;
  /** The session is no longer valid (revoked, expired, user deactivated). */
  onSessionInvalid(error: ApiError): void;
  /** The API requires a password change before anything else. */
  onPasswordChangeRequired(): void;
}

let authHandlers: AuthHandlers | null = null;

export function registerAuthHandlers(handlers: AuthHandlers): () => void {
  authHandlers = handlers;
  return () => {
    if (authHandlers === handlers) authHandlers = null;
  };
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const httpClient = axios.create({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  // Required for the httpOnly refresh cookie scoped to /auth.
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

httpClient.interceptors.request.use(async (config) => {
  config.headers.set('X-Request-Id', createRequestId());
  if (!config.skipAuth && authHandlers) {
    const token = await authHandlers.getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

httpClient.interceptors.response.use(undefined, async (error: unknown) => {
  const apiError = toApiError(error);
  const config = isAxiosError(error) ? error.config : undefined;
  if (!config || config.skipAuth || !authHandlers) throw apiError;

  if (apiError.status === 401) {
    if (apiError.code === ErrorCode.TOKEN_EXPIRED && !config.retriedAfterRefresh) {
      config.retriedAfterRefresh = true;
      const token = await authHandlers.refreshAccessToken();
      if (token) return httpClient.request(config);
    }
    if (!config.skipSessionHandling) authHandlers.onSessionInvalid(apiError);
  } else if (apiError.status === 403 && apiError.code === ErrorCode.PASSWORD_CHANGE_REQUIRED) {
    authHandlers.onPasswordChangeRequired();
  } else if (apiError.status === 403 && apiError.code === ErrorCode.USER_INACTIVE && !config.skipSessionHandling) {
    authHandlers.onSessionInvalid(apiError);
  }
  throw apiError;
});

export interface RequestOptions {
  signal?: AbortSignal;
}

/** GET a single resource and unwrap the envelope. */
export async function getData<T>(url: string, params?: object, options: RequestOptions = {}): Promise<T> {
  const response = await httpClient.get<ApiSuccessEnvelope<T>>(url, {
    params: params ? compactParams(params) : undefined,
    signal: options.signal,
  });
  return response.data.data;
}

/** GET a page of a collection. */
export async function getPage<T>(
  url: string,
  params?: object,
  options: RequestOptions = {},
): Promise<PaginatedResponse<T>> {
  const response = await httpClient.get<ApiPaginatedEnvelope<T>>(url, {
    params: params ? compactParams(params) : undefined,
    signal: options.signal,
  });
  return { items: response.data.data, meta: response.data.meta };
}

async function mutate<T>(
  method: 'post' | 'patch' | 'delete',
  url: string,
  body: unknown,
  config: AxiosRequestConfig,
): Promise<MutationResult<T>> {
  const response = await httpClient.request<ApiSuccessEnvelope<T>>({ ...config, method, url, data: body });
  return { data: response.data.data, message: response.data.message };
}

export function postData<T>(url: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<MutationResult<T>> {
  return mutate<T>('post', url, body, config);
}

export function patchData<T>(url: string, body: unknown, config: AxiosRequestConfig = {}): Promise<MutationResult<T>> {
  return mutate<T>('patch', url, body, config);
}

export function deleteData<T = null>(url: string, config: AxiosRequestConfig = {}): Promise<MutationResult<T>> {
  return mutate<T>('delete', url, undefined, config);
}
