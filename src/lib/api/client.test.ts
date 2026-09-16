import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AuthHandlers, getData, getPage, httpClient, postData, registerAuthHandlers } from './client';
import { getErrorMessage } from './error-messages';
import { ApiError } from './errors';

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse {
  const response: AxiosResponse = { data, status, statusText: String(status), headers, config, request: {} };
  if (status >= 400) throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response);
  return response;
}

const errorBody = (code: string, message = 'Failed') => ({ success: false, code, message, requestId: 'req-123' });
const ok = (data: unknown) => ({ success: true, message: 'OK', data });

describe('HTTP client', () => {
  const originalAdapter = httpClient.defaults.adapter;
  let handlers: { [K in keyof AuthHandlers]: ReturnType<typeof vi.fn> } & AuthHandlers;
  let unregister: () => void;

  const useAdapter = (adapter: Adapter) => {
    const mock = vi.fn(adapter);
    httpClient.defaults.adapter = mock;
    return mock;
  };

  beforeEach(() => {
    const getAccessToken = vi.fn(async () => 'token-1');
    const refreshAccessToken = vi.fn(async (): Promise<string | null> => 'token-2');
    const onSessionInvalid = vi.fn();
    const onPasswordChangeRequired = vi.fn();
    handlers = { getAccessToken, refreshAccessToken, onSessionInvalid, onPasswordChangeRequired };
    unregister = registerAuthHandlers(handlers);
  });

  afterEach(() => {
    unregister();
    httpClient.defaults.adapter = originalAdapter;
  });

  it('unwraps the envelope and sends the bearer token and a request id', async () => {
    const adapter = useAdapter(async (config) => respond(config, 200, ok({ id: 1 })));
    await expect(getData('/machines/1')).resolves.toEqual({ id: 1 });
    const config = adapter.mock.calls[0]?.[0];
    expect(config?.headers.get('Authorization')).toBe('Bearer token-1');
    expect(config?.headers.get('X-Request-Id')).toEqual(expect.any(String));
  });

  it('returns pages with their metadata and drops empty parameters', async () => {
    const adapter = useAdapter(async (config) =>
      respond(config, 200, { ...ok([{ id: 1 }]), meta: { page: 2, limit: 20, totalItems: 21, totalPages: 2 } }),
    );
    await expect(getPage('/machines', { page: 2, search: '', status: undefined })).resolves.toEqual({
      items: [{ id: 1 }],
      meta: { page: 2, limit: 20, totalItems: 21, totalPages: 2 },
    });
    expect(adapter.mock.calls[0]?.[0].params).toEqual({ page: 2 });
  });

  it('refreshes once and retries when the access token has expired', async () => {
    let calls = 0;
    const adapter = useAdapter(async (config) => {
      calls += 1;
      return calls === 1 ? respond(config, 401, errorBody('TOKEN_EXPIRED')) : respond(config, 200, ok('fresh'));
    });
    handlers.getAccessToken.mockResolvedValueOnce('stale-token').mockResolvedValue('token-2');

    await expect(getData('/machines')).resolves.toBe('fresh');
    expect(handlers.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1]?.[0].headers.get('Authorization')).toBe('Bearer token-2');
    expect(handlers.onSessionInvalid).not.toHaveBeenCalled();
  });

  it('ends the session when the token cannot be refreshed', async () => {
    useAdapter(async (config) => respond(config, 401, errorBody('TOKEN_EXPIRED')));
    handlers.refreshAccessToken.mockResolvedValue(null);

    await expect(getData('/machines')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
    expect(handlers.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(handlers.onSessionInvalid).toHaveBeenCalledTimes(1);
  });

  it('ends the session on a revoked token without trying to refresh', async () => {
    useAdapter(async (config) => respond(config, 401, errorBody('TOKEN_REVOKED')));
    await expect(getData('/machines')).rejects.toBeInstanceOf(ApiError);
    expect(handlers.refreshAccessToken).not.toHaveBeenCalled();
    expect(handlers.onSessionInvalid).toHaveBeenCalledTimes(1);
  });

  it('reports that a password change is required', async () => {
    useAdapter(async (config) => respond(config, 403, errorBody('PASSWORD_CHANGE_REQUIRED')));
    await expect(getData('/machines')).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    expect(handlers.onPasswordChangeRequired).toHaveBeenCalledTimes(1);
  });

  it('never attaches tokens to public endpoints or ends a session for their errors', async () => {
    const adapter = useAdapter(async (config) => respond(config, 401, errorBody('INVALID_CREDENTIALS', 'Invalid email or password')));
    await expect(postData('/auth/login', { email: 'a@b.co', password: 'x' }, { skipAuth: true })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(adapter.mock.calls[0]?.[0].headers.get('Authorization')).toBeUndefined();
    expect(handlers.getAccessToken).not.toHaveBeenCalled();
    expect(handlers.onSessionInvalid).not.toHaveBeenCalled();
  });

  it('keeps API error details and the request id', async () => {
    useAdapter(async (config) =>
      respond(config, 409, { ...errorBody('MACHINE_SERIAL_EXISTS', 'Machine serial number already exists'), details: [{ field: 'serialNumber', message: 'exists' }] }),
    );
    const error = await postData('/machines', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, requestId: 'req-123', details: [{ field: 'serialNumber', message: 'exists' }] });
    expect(getErrorMessage(error)).toBe('A machine with this serial number already exists.');
  });

  it('normalises network failures and timeouts', async () => {
    useAdapter(async (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
    });
    const error = await getData('/machines').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(getErrorMessage(error)).toBe("Can't reach the server. Check your connection and try again.");

    useAdapter(async (config) => {
      throw new AxiosError('timeout', AxiosError.ECONNABORTED, config, {});
    });
    await expect(getData('/machines')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
