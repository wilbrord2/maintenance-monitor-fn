import { isAxiosError } from 'axios';
import { ClientErrorCode, ErrorCode } from '@/constants/error-codes';
import { type ApiErrorDetail, type ApiErrorEnvelope } from '@/types/api';

interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: readonly ApiErrorDetail[];
  requestId?: string | null;
  retryAfterSeconds?: number | null;
}

/** Normalised error for every failed request: API errors, network failures and timeouts. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  /** HTTP status, or 0 when no response was received. */
  readonly status: number;
  readonly code: string;
  readonly details: readonly ApiErrorDetail[];
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  hasCode(...codes: readonly string[]): boolean {
    return codes.includes(this.code);
  }

  get isNetworkError(): boolean {
    return this.code === ClientErrorCode.NETWORK_ERROR || this.code === ClientErrorCode.TIMEOUT;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === false &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function codeForStatus(status: number): string {
  if (status === 400) return ErrorCode.BAD_REQUEST;
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 409) return ErrorCode.CONFLICT;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status === 503) return ErrorCode.SERVICE_UNAVAILABLE;
  if (status >= 500) return ErrorCode.INTERNAL_ERROR;
  return ClientErrorCode.UNKNOWN;
}

function readHeader(headers: unknown, name: string): string | null {
  if (typeof headers !== 'object' || headers === null) return null;
  const value: unknown = (headers as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

/** Converts anything thrown by the HTTP layer into an {@link ApiError}. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') {
      return new ApiError({ status: 0, code: ClientErrorCode.CANCELLED, message: 'The request was cancelled.' });
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ status: 0, code: ClientErrorCode.TIMEOUT, message: 'The request timed out.' });
    }
    const response = error.response;
    if (!response) {
      return new ApiError({ status: 0, code: ClientErrorCode.NETWORK_ERROR, message: 'The server could not be reached.' });
    }
    const requestId = readHeader(response.headers, 'x-request-id');
    const retryAfterSeconds = parseRetryAfter(readHeader(response.headers, 'retry-after'));
    const body: unknown = response.data;
    if (isErrorEnvelope(body)) {
      return new ApiError({
        status: response.status,
        code: body.code,
        message: body.message,
        details: body.details ?? [],
        requestId: body.requestId ?? requestId,
        retryAfterSeconds,
      });
    }
    return new ApiError({
      status: response.status,
      code: codeForStatus(response.status),
      message: response.statusText || 'The request failed.',
      requestId,
      retryAfterSeconds,
    });
  }

  return new ApiError({
    status: 0,
    code: ClientErrorCode.UNKNOWN,
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
  });
}
