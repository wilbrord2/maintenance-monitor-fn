'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { analyticsApi } from '@/lib/api/analytics';
import { type AnalyticsFaultsParams, type AnalyticsRangeParams, type AnalyticsTopParams } from '@/types/analytics';

/** Analytics are aggregates over history: cache for a minute and keep the previous range visible while loading. */
const ANALYTICS_STALE_TIME = 60_000;

interface QueryToggle {
  enabled?: boolean;
}

export function useAnalyticsOverview(range: AnalyticsRangeParams, options: QueryToggle = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.overview(range),
    queryFn: ({ signal }) => analyticsApi.overview(range, { signal }),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useDowntimeAnalytics(params: AnalyticsTopParams, options: QueryToggle = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.downtime(params),
    queryFn: ({ signal }) => analyticsApi.downtime(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useMaintenanceEventsAnalytics(params: AnalyticsTopParams, options: QueryToggle = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.maintenanceEvents(params),
    queryFn: ({ signal }) => analyticsApi.maintenanceEvents(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useTechnicianAnalytics(params: AnalyticsTopParams, options: QueryToggle = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.technicians(params),
    queryFn: ({ signal }) => analyticsApi.technicians(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useFaultAnalytics(params: AnalyticsFaultsParams, options: QueryToggle = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.faults(params),
    queryFn: ({ signal }) => analyticsApi.faults(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}
