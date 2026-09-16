export type SortOrder = 'asc' | 'desc';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/** A page of a collection, unwrapped from the API envelope. */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Envelope of every successful API response. */
export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiPaginatedEnvelope<T> extends ApiSuccessEnvelope<T[]> {
  meta: PaginationMeta;
}

/** Envelope of every failed API response. */
export interface ApiErrorEnvelope {
  success: false;
  message: string;
  code: string;
  timestamp?: string;
  path?: string;
  requestId?: string;
  details?: ApiErrorDetail[];
}

/** Result of a mutation: the payload plus the server's human-readable message. */
export interface MutationResult<T> {
  data: T;
  message: string;
}

export interface PageParams {
  page?: number;
  limit?: number;
}

export interface SortParams<TField extends string> {
  sortBy?: TField;
  sortOrder?: SortOrder;
}

/** Inclusive calendar-day range (YYYY-MM-DD, interpreted in UTC by the API). */
export interface DateRangeParams {
  from?: string;
  to?: string;
}
