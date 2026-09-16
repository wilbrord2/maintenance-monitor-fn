import { ClientErrorCode, ErrorCode } from '@/constants/error-codes';
import { isApiError, toApiError } from './errors';

/** Human-readable messages for error codes. Keep them short, specific and actionable. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  [ErrorCode.VALIDATION_ERROR]: 'Some fields are invalid. Check the highlighted fields and try again.',
  [ErrorCode.FORBIDDEN]: "You don't have permission to perform this action.",
  [ErrorCode.PASSWORD_CHANGE_REQUIRED]: 'You must change your temporary password before continuing.',
  [ErrorCode.UNAUTHORIZED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.TOKEN_INVALID]: 'Your session has expired. Please sign in again.',
  [ErrorCode.TOKEN_REVOKED]: 'Your session has ended. Please sign in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Incorrect email or password.',
  [ErrorCode.ACCOUNT_LOCKED]: 'Too many failed attempts. Your account is temporarily locked — try again later.',
  [ErrorCode.TEMPORARY_PASSWORD_EXPIRED]:
    'Your temporary password has expired. Ask an administrator to issue a new one.',
  [ErrorCode.USER_INACTIVE]: 'This account is deactivated. Contact an administrator.',
  [ErrorCode.INVALID_RESET_TOKEN]: 'This reset link is invalid or has expired. Request a new link.',
  [ErrorCode.PASSWORD_REUSE]: 'Choose a password that is different from your current one.',
  [ErrorCode.USER_EMAIL_EXISTS]: 'An account with this email address already exists.',
  [ErrorCode.USER_PHONE_EXISTS]: 'An account with this phone number already exists.',
  [ErrorCode.USER_SELF_MODIFICATION_FORBIDDEN]: "You can't perform this action on your own account.",
  [ErrorCode.USER_NOT_TECHNICIAN]: 'This action is only available for technician accounts.',
  [ErrorCode.USER_NOT_FOUND]: 'This user could not be found. It may have been removed.',
  [ErrorCode.MACHINE_NOT_FOUND]: 'This machine could not be found. It may have been removed.',
  [ErrorCode.MACHINE_LOG_NOT_FOUND]: 'This log could not be found. It may have been deleted.',
  [ErrorCode.MACHINE_SERIAL_EXISTS]: 'A machine with this serial number already exists.',
  [ErrorCode.MACHINE_INACTIVE]: 'This machine is deactivated and cannot accept new logs.',
  [ErrorCode.MACHINE_HAS_OPEN_LOGS]: 'This machine still has open logs. Close them before deleting the machine.',
  [ErrorCode.MACHINE_STATE_CONFLICT]:
    'This machine was updated by another user. Refresh the machine and try again.',
  [ErrorCode.STALE_VERSION]:
    'This log was changed by someone else since you opened it. Reload it to see the latest version.',
  [ErrorCode.RESULTING_STATE_IMMUTABLE]:
    "The resulting state can only be changed on the machine's most recent log.",
  [ErrorCode.INVALID_STATE_TRANSITION]: "This state change isn't allowed from the machine's current state.",
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again shortly.',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'The submitted content is too large.',
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
  [ClientErrorCode.NETWORK_ERROR]: "Can't reach the server. Check your connection and try again.",
  [ClientErrorCode.TIMEOUT]: 'The server took too long to respond. Please try again.',
  [ClientErrorCode.CANCELLED]: 'The request was cancelled.',
};

/** Business-rule errors whose server message is already specific and user-facing. */
const SERVER_MESSAGE_CODES: ReadonlySet<string> = new Set([
  ErrorCode.INVALID_LOG_STATUS,
  ErrorCode.INVALID_LOG_TIMES,
  ErrorCode.INVALID_DOWNTIME,
  ErrorCode.INVALID_TIME_RANGE,
]);

function messageForStatus(status: number): string {
  if (status === 400) return 'The request was invalid. Check your input and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return 'The requested item could not be found.';
  if (status === 409) return 'This item was changed by another user. Refresh and try again.';
  if (status === 422) return "The request couldn't be processed. Check your input and try again.";
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}

/**
 * Returns a message suitable for toasts and inline alerts. `overrides` lets a screen give a
 * code a context-specific meaning (e.g. INVALID_CREDENTIALS on change-password).
 */
export function getErrorMessage(error: unknown, overrides: Readonly<Record<string, string>> = {}): string {
  const apiError = toApiError(error);
  const override = overrides[apiError.code];
  if (override) return override;
  if (SERVER_MESSAGE_CODES.has(apiError.code) && apiError.message) return apiError.message;
  if (apiError.code === ErrorCode.RATE_LIMITED && apiError.retryAfterSeconds) {
    return `Too many requests. Try again in ${apiError.retryAfterSeconds} seconds.`;
  }
  if (apiError.code === ErrorCode.INVALID_STATE_TRANSITION && apiError.details.length > 0) {
    return `${CODE_MESSAGES[apiError.code]} ${apiError.details.map((detail) => detail.message).join(' ')}`;
  }
  return CODE_MESSAGES[apiError.code] ?? messageForStatus(apiError.status);
}

/** A short heading for error panels. */
export function getErrorTitle(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  if (error.isNetworkError) return 'Connection problem';
  if (error.status === 403) return 'Access denied';
  if (error.status === 404) return 'Not found';
  if (error.status === 409) return 'Out of date';
  if (error.status === 429) return 'Slow down';
  if (error.status >= 500) return 'Server error';
  return 'Something went wrong';
}
